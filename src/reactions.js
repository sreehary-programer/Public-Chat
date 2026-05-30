import { state } from "./state.js";
import { persistReactionToggle } from "./supabaseMessages.js";
let reactionTargetMsgId = null;
export function initReactions(refs) {
    const reactionPicker = document.getElementById("reactionPicker");
    if (!reactionPicker) {
        throw new Error("reactionPicker not found");
    }
    reactionPicker
        .querySelectorAll(".emoji-btn")
        .forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const emoji = btn.dataset.emoji;
            if (reactionTargetMsgId && emoji) {
                toggleReaction(reactionTargetMsgId, emoji, refs);
            }
            reactionPicker.classList.remove("open");
            reactionPicker.style.display = "none";
        });
    });
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (!reactionPicker.contains(target) &&
            !target.closest(".react-btn")) {
            reactionPicker.classList.remove("open");
            reactionPicker.style.display = "none";
        }
    });
}
export function getReactions(msgId) {
    return state.reactions[msgId] || {};
}
export function getUserReacted(msgId, emoji) {
    return (state.userReactions[msgId] ?? new Set()).has(emoji);
}
export function toggleReaction(msgId, emoji, refs) {
    if (!state.reactions[msgId])
        state.reactions[msgId] = {};
    if (!state.userReactions[msgId])
        state.userReactions[msgId] = new Set();
    const wasReacted = state.userReactions[msgId].has(emoji);
    // ── Optimistic local update ───────────────────────────────────────────────
    if (wasReacted) {
        state.userReactions[msgId].delete(emoji);
        state.reactions[msgId][emoji] = Math.max(0, (state.reactions[msgId][emoji] || 1) - 1);
        if (state.reactions[msgId][emoji] === 0) {
            delete state.reactions[msgId][emoji];
        }
    }
    else {
        state.userReactions[msgId].add(emoji);
        state.reactions[msgId][emoji] = (state.reactions[msgId][emoji] || 0) + 1;
    }
    // ── Persist to Supabase (fire-and-forget; optimistic UI already updated) ──
    persistReactionToggle(msgId, emoji, !wasReacted).catch((err) => {
        console.error("[toggleReaction] persist failed:", err);
        // Roll back optimistic update on failure
        if (!wasReacted) {
            state.userReactions[msgId].delete(emoji);
            state.reactions[msgId][emoji] = Math.max(0, (state.reactions[msgId][emoji] || 1) - 1);
            if (state.reactions[msgId][emoji] === 0)
                delete state.reactions[msgId][emoji];
        }
        else {
            state.userReactions[msgId].add(emoji);
            state.reactions[msgId][emoji] = (state.reactions[msgId][emoji] || 0) + 1;
        }
        // Re-render after rollback
        const groupEl = refs.messageStream.querySelector(`[data-message-id="${msgId}"]`);
        if (groupEl) {
            let strip = groupEl.querySelector(".reactions-strip");
            if (!strip) {
                strip = document.createElement("div");
                strip.className = "reactions-strip";
                groupEl.appendChild(strip);
            }
            renderReactionsStrip(msgId, strip, refs);
        }
    });
    // ── Update DOM ────────────────────────────────────────────────────────────
    const groupEl = refs.messageStream.querySelector(`[data-message-id="${msgId}"]`);
    if (!groupEl)
        return;
    let strip = groupEl.querySelector(".reactions-strip");
    if (!strip) {
        strip = document.createElement("div");
        strip.className = "reactions-strip";
        groupEl.appendChild(strip);
    }
    renderReactionsStrip(msgId, strip, refs);
}
export function renderReactionsStrip(msgId, stripEl, refs) {
    stripEl.innerHTML = "";
    const reactions = getReactions(msgId);
    Object.entries(reactions).forEach(([emoji, count]) => {
        if (count <= 0)
            return;
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
export function openReactionPicker(msgId, anchorEl) {
    const reactionPicker = document.getElementById("reactionPicker");
    if (!reactionPicker)
        return;
    reactionTargetMsgId = msgId;
    document.body.appendChild(reactionPicker);
    reactionPicker.style.display = "flex";
    reactionPicker.classList.add("open");
    const rect = anchorEl.getBoundingClientRect();
    reactionPicker.style.position = "fixed";
    reactionPicker.style.top = `${rect.bottom + 4}px`;
    reactionPicker.style.left = `${rect.left}px`;
}
