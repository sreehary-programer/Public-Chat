import { state } from "./state.js";
import type { DOMRefs } from "./types.js";
import { persistReactionToggle } from "./supabaseMessages.js";

let reactionTargetMsgId: string | null = null;

export function initReactions(refs: DOMRefs): void {
  const reactionPicker = document.getElementById(
    "reactionPicker"
  ) as HTMLDivElement | null;

  if (!reactionPicker) {
    throw new Error("reactionPicker not found");
  }

  reactionPicker
    .querySelectorAll<HTMLButtonElement>(".emoji-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();

        const emoji = btn.dataset.emoji;

        if (reactionTargetMsgId && emoji) {
          toggleReaction(reactionTargetMsgId, emoji, refs);
        }

        reactionPicker.classList.remove("open");
        reactionPicker.style.display = "none";
      });
    });

  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (
      !reactionPicker.contains(target) &&
      !target.closest(".react-btn")
    ) {
      reactionPicker.classList.remove("open");
      reactionPicker.style.display = "none";
    }
  });
}

export function getReactions(msgId: string): Record<string, number> {
  return state.reactions[msgId] || {};
}

export function getUserReacted(msgId: string, emoji: string): boolean {
  return (state.userReactions[msgId] ?? new Set<string>()).has(emoji);
}

export function toggleReaction(
  msgId: string,
  emoji: string,
  refs: DOMRefs
): void {
  if (!state.reactions[msgId])    state.reactions[msgId]    = {};
  if (!state.userReactions[msgId]) state.userReactions[msgId] = new Set<string>();

  const wasReacted = state.userReactions[msgId].has(emoji);

  // ── Optimistic local update ───────────────────────────────────────────────
  if (wasReacted) {
    state.userReactions[msgId].delete(emoji);
    state.reactions[msgId][emoji] = Math.max(
      0,
      (state.reactions[msgId][emoji] || 1) - 1
    );
    if (state.reactions[msgId][emoji] === 0) {
      delete state.reactions[msgId][emoji];
    }
  } else {
    state.userReactions[msgId].add(emoji);
    state.reactions[msgId][emoji] = (state.reactions[msgId][emoji] || 0) + 1;
  }

  // ── Persist to Supabase (fire-and-forget; optimistic UI already updated) ──
  persistReactionToggle(msgId, emoji, !wasReacted).catch((err) => {
    console.error("[toggleReaction] persist failed:", err);
    // Roll back optimistic update on failure
    if (!wasReacted) {
      state.userReactions[msgId].delete(emoji);
      state.reactions[msgId][emoji] = Math.max(
        0,
        (state.reactions[msgId][emoji] || 1) - 1
      );
      if (state.reactions[msgId][emoji] === 0) delete state.reactions[msgId][emoji];
    } else {
      state.userReactions[msgId].add(emoji);
      state.reactions[msgId][emoji] = (state.reactions[msgId][emoji] || 0) + 1;
    }
    // Re-render after rollback
    const groupEl = refs.messageStream.querySelector<HTMLElement>(
      `[data-message-id="${msgId}"]`
    );
    if (groupEl) {
      let strip = groupEl.querySelector<HTMLDivElement>(".reactions-strip");
      if (!strip) {
        strip = document.createElement("div");
        strip.className = "reactions-strip";
        groupEl.appendChild(strip);
      }
      renderReactionsStrip(msgId, strip, refs);
    }
  });

  // ── Update DOM ────────────────────────────────────────────────────────────
  const groupEl = refs.messageStream.querySelector<HTMLElement>(
    `[data-message-id="${msgId}"]`
  );
  if (!groupEl) return;

  let strip = groupEl.querySelector<HTMLDivElement>(".reactions-strip");
  if (!strip) {
    strip = document.createElement("div");
    strip.className = "reactions-strip";
    groupEl.appendChild(strip);
  }

  renderReactionsStrip(msgId, strip, refs);
}

export function renderReactionsStrip(
  msgId: string,
  stripEl: HTMLElement,
  refs: DOMRefs
): void {
  stripEl.innerHTML = "";

  const reactions = getReactions(msgId);

  Object.entries(reactions).forEach(([emoji, count]) => {
    if (count <= 0) return;

    const pill = document.createElement("button");
    pill.className =
      "reaction-pill" + (getUserReacted(msgId, emoji) ? " reacted" : "");
    pill.innerHTML = `${emoji} <span class="reaction-count">${count}</span>`;

    pill.addEventListener("click", () => {
      toggleReaction(msgId, emoji, refs);
    });

    stripEl.appendChild(pill);
  });
}

export function openReactionPicker(
  msgId: string,
  anchorEl: HTMLElement
): void {
  const reactionPicker = document.getElementById(
    "reactionPicker"
  ) as HTMLDivElement | null;

  if (!reactionPicker) return;

  reactionTargetMsgId = msgId;

  document.body.appendChild(reactionPicker);

  reactionPicker.style.display = "flex";
  reactionPicker.classList.add("open");

  const rect = anchorEl.getBoundingClientRect();

  reactionPicker.style.position = "fixed";
  reactionPicker.style.top  = `${rect.bottom + 4}px`;
  reactionPicker.style.left = `${rect.left}px`;
}
