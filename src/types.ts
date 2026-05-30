// ─── Core domain types ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  created_at: string;       // ISO-8601 timestamp, e.g. "2026-05-22T09:14:00Z"
  channel_id: string;       // matches a Channel.id, e.g. "ch_general"
  sender_name: string;      // display handle, e.g. "maya.r" or LOCAL_USER
  message_text: string;     // raw content; may contain inline code backticks
}

export interface Channel {
  id: string;               // e.g. "ch_general"
  name: string;             // e.g. "general"
  description: string;
  unread_count: number;
}

export interface DirectMessage {
  handle: string;           // e.g. "maya.r"
  status: "online" | "away" | "offline";
}

// ─── App-level state shape ────────────────────────────────────────────────────

export interface AppState {
  localUser: string;                       // sender_name treated as "you"
  activeChannelId: string;                 // currently selected channel
  channels: Channel[];
  directMessages: DirectMessage[];
  activeMessages: ChatMessage[];           // messages for activeChannelId
    reactions: Record<string, Record<string, number>>;
  userReactions: Record<string, Set<string>>;

  pinnedMessages: string[];

  replyingTo: ChatMessage | null;
}

// ─── DOM helper types ─────────────────────────────────────────────────────────

/** Typed refs to elements queried once and reused across renders. */
export interface DOMRefs {
  messageStream: HTMLElement;
  messageInput: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  channelTitle: HTMLElement;
}

// ─── Render options ───────────────────────────────────────────────────────────

export interface RenderOptions {
  /** When true the bubble is appended and scrolled into view; default true */
  scrollIntoView?: boolean;
}
