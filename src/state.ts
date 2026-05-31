import type { AppState, ChatMessage } from "./types.js";

// ─── Seed messages (general channel demo content) ─────────────────────────────

const seedMessages: ChatMessage[] = [
  {
    id: "msg_001",
    created_at: "2026-05-22T09:14:00Z",
    channel_id: "ch_general",
    sender_name: "maya.r",
    message_text:
      "Hey team — I just pushed the new auth middleware to the staging branch. Can someone take a look before we merge?",
  },
  {
    id: "msg_002",
    created_at: "2026-05-22T09:17:00Z",
    channel_id: "ch_general",
    sender_name: "j.park",
    message_text:
      "On it. Which file is the entry point? The middleware folder has like 8 files now",
  },
  {
    id: "msg_003",
    created_at: "2026-05-22T09:19:00Z",
    channel_id: "ch_general",
    sender_name: "you",
    message_text:
      "It's `src/middleware/auth.ts` — exports a single `withAuth` wrapper. Should be pretty readable.",
  },
  {
    id: "msg_004",
    created_at: "2026-05-22T09:22:00Z",
    channel_id: "ch_general",
    sender_name: "maya.r",
    message_text:
      "Looks clean. Should we handle token expiry separately or bubble it up from `verifyToken`?",
  },
  {
    id: "msg_005",
    created_at: "2026-05-22T09:25:00Z",
    channel_id: "ch_general",
    sender_name: "you",
    message_text:
      "Let's handle it inside `verifyToken` and throw a typed error. That way every route gets consistent 401 behaviour without extra boilerplate.",
  },
  {
    id: "msg_006",
    created_at: "2026-05-22T09:27:00Z",
    channel_id: "ch_general",
    sender_name: "j.park",
    message_text:
      "Agreed. Also — are we still on the Pages Router or should we switch the handler typing to App Router?",
  },
  {
    id: "msg_007",
    created_at: "2026-05-22T09:29:00Z",
    channel_id: "ch_general",
    sender_name: "you",
    message_text:
      "Good catch. We're migrating next sprint — keep Pages Router types for now and flag it with a TODO so it's obvious in the diff.",
  },
  {
    id: "msg_008",
    created_at: "2026-05-22T09:31:00Z",
    channel_id: "ch_general",
    sender_name: "maya.r",
    message_text:
      "Perfect. I'll add the TODO and push a small update. PR should be review-ready in ~10 mins.",
  },
];

// ─── Singleton state ──────────────────────────────────────────────────────────

export const state: AppState = {
  localUser:       "you",
  activeChannelId: "ch_general",

  // Hardcoded seed channels — loadPersistedChannels() will append any extras
  // that exist in Supabase without duplicating these.
  channels: [
    { id: "ch_general",     name: "general",         description: "Team-wide discussion", unread_count: 0 },
    { id: "ch_engineering", name: "engineering-room", description: "Engineering topics",   unread_count: 2 },
    { id: "ch_design",      name: "design-system",   description: "Design tokens & UI",   unread_count: 0 },
    { id: "ch_api",         name: "api-integration", description: "API work",              unread_count: 0 },
    { id: "ch_deployments", name: "deployments",     description: "Deploy pipeline",       unread_count: 1 },
    { id: "ch_review",      name: "code-review",     description: "PR reviews",            unread_count: 0 },
    { id: "ch_incidents",   name: "incidents",       description: "On-call & incidents",   unread_count: 0 },
    { id: "ch_releases",    name: "releases",        description: "Release notes",         unread_count: 0 },
  ],

  directMessages: [
    { handle: "maya.r",  status: "online"  },
    { handle: "j.park",  status: "online"  },
    { handle: "sam.dev", status: "offline" },
  ],

  activeMessages:  [...seedMessages],
  reactions:       {},   // msgId → { emoji: count }
  userReactions:   {},   // msgId → Set<emoji>
  pinnedMessages:  ["msg_008"],
  replyingTo:      null,
};

// ─── State mutations ──────────────────────────────────────────────────────────

/**
 * Appends a new message to activeMessages and returns the fully-typed object.
 */
export function addMessage(
  text: string,
  senderName: string = state.localUser
): ChatMessage {
  const msg: ChatMessage = {
    id:           `msg_${Date.now()}`,
    created_at:   new Date().toISOString(),
    channel_id:   state.activeChannelId,
    sender_name:  senderName,
    message_text: text.trim(),
  };
  state.activeMessages.push(msg);
  return msg;
}

/**
 * Switches the active channel and clears the message list.
 * loadHistoricalMessages() will re-populate it from the DB.
 */
export function switchChannel(channelId: string): void {
  const channel = state.channels.find((ch) => ch.id === channelId);
  if (!channel) return;
  state.activeChannelId  = channelId;
  state.activeMessages   = [];
  channel.unread_count   = 0;
}