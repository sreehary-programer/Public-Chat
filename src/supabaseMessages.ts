import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";

import { supabase } from "./supabaseClient.js";

import type {
  Tables,
  TablesInsert,
} from "./database.types.js";

import type { ChatMessage, DOMRefs } from "./types.js";
import { state } from "./state.js";
import { renderMessageBubble, renderAllMessages } from "./render.js";

type MessageRow = Tables<"messages">;
type MessageInsert = TablesInsert<"messages">;

// ─── Row ↔ domain mapper ──────────────────────────────────────────────────────

function rowToMessage(row: MessageRow & { replied_msg?: MessageRow | null }): ChatMessage {
  const msg: ChatMessage = {
    id: row.id,
    created_at: row.created_at,
    channel_id: row.channel_id,
    sender_name: row.sender_name,
    message_text: row.message_text,
  };

  // Attach reply snapshot if the joined row is present
  if (row.replied_msg) {
    (msg as any).replyTo = {
      sender_name: row.replied_msg.sender_name,
      message_text: row.replied_msg.message_text,
    };
  }

  return msg;
}

// ─── 1. Historical load ───────────────────────────────────────────────────────

export async function loadHistoricalMessages(refs: DOMRefs): Promise<void> {
  // Join replies inline so we get the quoted text in one query
  const { data, error } = await supabase
    .from("messages")
    .select("*, replied_msg:reply_to_id(id, sender_name, message_text)")
    .eq("channel_id", state.activeChannelId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[loadHistoricalMessages] Supabase SELECT failed:", error.message);
    return;
  }

  if (data) {
    state.activeMessages = (data as any[]).map(rowToMessage);
    renderAllMessages(refs);
  }
}

// ─── 2. Load reactions for the active channel ─────────────────────────────────

export async function loadReactions(refs: DOMRefs): Promise<void> {
  const messageIds = state.activeMessages.map((m) => m.id);
  if (messageIds.length === 0) return;

  const { data, error } = await supabase
    .from("reactions")
    .select("message_id, sender_name, emoji")
    .in("message_id", messageIds);

  if (error) {
    console.error("[loadReactions] Supabase SELECT failed:", error.message);
    return;
  }

  if (!data) return;

  state.reactions = {};
  state.userReactions = {};

  for (const row of data as { message_id: string; sender_name: string; emoji: string }[]) {
    const { message_id, sender_name, emoji } = row;

    if (!state.reactions[message_id]) state.reactions[message_id] = {};
    state.reactions[message_id][emoji] = (state.reactions[message_id][emoji] || 0) + 1;

    if (sender_name === state.localUser) {
      if (!state.userReactions[message_id]) state.userReactions[message_id] = new Set();
      state.userReactions[message_id].add(emoji);
    }
  }

  // Render reaction strips onto already-rendered message bubbles
  for (const msgId of Object.keys(state.reactions)) {
    const groupEl = refs.messageStream.querySelector<HTMLElement>(
      `[data-message-id="${msgId}"]`
    );
    if (!groupEl) continue;

    let strip = groupEl.querySelector<HTMLDivElement>(".reactions-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "reactions-strip";
      groupEl.appendChild(strip);
    }

    strip.innerHTML = "";
    for (const [emoji, count] of Object.entries(state.reactions[msgId])) {
      if (count <= 0) continue;
      const userReacted = (state.userReactions[msgId] ?? new Set()).has(emoji);
      const pill = document.createElement("button");
      pill.className = "reaction-pill" + (userReacted ? " reacted" : "");
      pill.innerHTML = `${emoji} <span class="reaction-count">${count}</span>`;
      // Use dynamic import to avoid circular dependency
      pill.addEventListener("click", () => {
        import("./reactions.js").then(({ toggleReaction }) => {
          toggleReaction(msgId, emoji, refs);
        });
      });
      strip.appendChild(pill);
    }
  }
}

// ─── 3. Realtime listener ─────────────────────────────────────────────────────

export function initializeRealtimeListener(refs: DOMRefs): RealtimeChannel {
  const channelName = `messages:${state.activeChannelId}`;
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on<MessageRow>(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
        filter: `channel_id=eq.${state.activeChannelId}`,
      },
      async (payload: RealtimePostgresInsertPayload<MessageRow>) => {
        const row = payload.new as MessageRow & { reply_to_id?: string | null };

        const alreadyPresent = state.activeMessages.some(
          (m) => m.id === row.id
        );
        if (alreadyPresent) return;

        // Fetch reply snapshot if this message has one
        let replied_msg: MessageRow | null = null;
        if (row.reply_to_id) {
          const { data } = await supabase
            .from("messages")
            .select("id, sender_name, message_text")
            .eq("id", row.reply_to_id)
            .single();
          replied_msg = data ?? null;
        }

        const incoming: ChatMessage = rowToMessage({ ...row, replied_msg });

        state.activeMessages.push(incoming);
        renderMessageBubble(incoming, refs);
      }
    );

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.info(`[realtime] Listening on ${channelName}`);
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(`[realtime] Channel error on ${channelName}:`, err?.message ?? status);
    }
  });

  return channel;
}

// ─── 4. Send message via Supabase INSERT ──────────────────────────────────────
type SendState = "idle" | "pending" | "error";

let currentSendState: SendState = "idle";

export async function sendMessage(
  text: string,
  refs: DOMRefs,
  replyTo?: { id: string; sender_name: string; message_text: string }
): Promise<boolean> {
  const trimmed = text.trim();

  if (!trimmed || currentSendState === "pending") {
    return false;
  }

  currentSendState = "pending";
  setSendButtonState(refs.sendButton, "pending");

  // Optimistic message
  const optimisticId = `opt_${Date.now()}`;

  const optimisticMsg: ChatMessage & { replyTo?: { sender_name: string; message_text: string } } = {
    id: optimisticId,
    created_at: new Date().toISOString(),
    channel_id: state.activeChannelId,
    sender_name: state.localUser,
    message_text: trimmed,
    replyTo: replyTo ? { sender_name: replyTo.sender_name, message_text: replyTo.message_text } : undefined,
  };

  state.activeMessages.push(optimisticMsg);

  const bubble = renderMessageBubble(optimisticMsg, refs);

  const insertPayload: MessageInsert & { reply_to_id?: string } = {
    channel_id:   state.activeChannelId,
    sender_name:  state.localUser,
    message_text: trimmed,
    ...(replyTo?.id ? { reply_to_id: replyTo.id } : {}),
  };

  const { data, error } = await supabase
    .from("messages")
    .insert([insertPayload])
    .select("id")
    .single();

  currentSendState = "idle";
  setSendButtonState(refs.sendButton, "idle");

  if (error) {
    console.error("[sendMessage] INSERT failed:", error.message);
    markBubbleError(bubble);
    state.activeMessages = state.activeMessages.filter((m) => m.id !== optimisticId);
    return false;
  }

  if (data) {
    optimisticMsg.id = data.id;
    bubble.dataset.messageId = data.id;
    // Keep .msg-actions[data-msg-id] in sync so reactions/replies work immediately
    const actionsEl = bubble.querySelector<HTMLElement>(".msg-actions");
    if (actionsEl) actionsEl.dataset.msgId = data.id;
  }

  return true;
}

// ─── 5. Toggle reaction in Supabase ──────────────────────────────────────────

export async function persistReactionToggle(
  msgId: string,
  emoji: string,
  isAdding: boolean
): Promise<void> {
  if (isAdding) {
    const { error } = await supabase
      .from("reactions")
      .insert([{ message_id: msgId, sender_name: state.localUser, emoji }]);

    if (error) {
      console.error("[persistReactionToggle] INSERT failed:", error.message);
    }
  } else {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("message_id", msgId)
      .eq("sender_name", state.localUser)
      .eq("emoji", emoji);

    if (error) {
      console.error("[persistReactionToggle] DELETE failed:", error.message);
    }
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setSendButtonState(btn: HTMLButtonElement, sendState: SendState): void {
  btn.disabled = sendState === "pending";
  btn.style.opacity = sendState === "pending" ? "0.5" : "1";
}

function markBubbleError(bubble: HTMLElement): void {
  bubble.style.opacity = "0.5";
  const errTag = document.createElement("span");
  errTag.className = "send-error-tag";
  errTag.textContent = "failed to send";
  bubble.appendChild(errTag);
}
