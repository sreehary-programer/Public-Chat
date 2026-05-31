import type { DOMRefs } from "./types.js";
import { state, switchChannel } from "./state.js";
import {
  loadHistoricalMessages,
  loadReactions,
  initializeRealtimeListener,
  sendMessage,
} from "./supabaseMessages.js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { initEmojiPicker }                               from "./emojiPicker.js";
import { initScrollSentinel }                            from "./scroll.js";
import { runSendLifecycle, autoResizeTextarea }          from "./inputManager.js";
import {
  initConnectionBanner,
  initConnectionListeners,
  updateFromRealtimeStatus,
} from "./connectionStatus.js";
import { initStatusMenu }                                from "./statusMenu.js";
import { initTypingIndicator }                           from "./typingIndicator.js";
import { initSearch }                                    from "./search.js";
import { initAddChannel, loadPersistedChannels }         from "./addChannel.js";
import { initReactions, openReactionPicker }             from "./reactions.js";
import { initReply, setReplyTo, clearReply }             from "./reply.js";

// ─── DOM query helper ─────────────────────────────────────────────────────────

function queryOrThrow<T extends HTMLElement>(
  selector: string,
  context: ParentNode = document
): T {
  const el = context.querySelector<T>(selector);
  if (!el) throw new Error(`Required element not found: "${selector}"`);
  return el;
}

// ─── Typed DOM refs ───────────────────────────────────────────────────────────

const refs: DOMRefs = {
  messageStream: queryOrThrow<HTMLElement>(".message-stream"),
  messageInput:  queryOrThrow<HTMLTextAreaElement>(".msg-input"),
  sendButton:    queryOrThrow<HTMLButtonElement>(".send-btn"),
  channelTitle:  queryOrThrow<HTMLElement>("#desktopChannelTitle"),
};

// ─── Sidebar elements ─────────────────────────────────────────────────────────

const sidebar         = document.getElementById("sidebar");
const sidebarOverlay  = document.getElementById("sidebarOverlay");
const openSidebarBtn  = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const mobileTitle     = document.getElementById("mobileChannelTitle");

// ─── Sidebar open / close helpers ────────────────────────────────────────────

function openSidebar(): void {
  sidebar?.classList.add("sidebar--open");
  sidebarOverlay?.classList.add("overlay--visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar(): void {
  sidebar?.classList.remove("sidebar--open");
  sidebarOverlay?.classList.remove("overlay--visible");
  document.body.style.overflow = "";
}

openSidebarBtn?.addEventListener("click",  openSidebar);
closeSidebarBtn?.addEventListener("click", closeSidebar);
sidebarOverlay?.addEventListener("click",  closeSidebar);

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") closeSidebar();
});

// ─── Feature init (non-async) ─────────────────────────────────────────────────

initScrollSentinel(refs.messageStream);
initTypingIndicator(refs);
initSearch(refs, closeSidebar);
initEmojiPicker(refs);
initReactions(refs);
initReply(refs);
initAddChannel(activateChannel);   // wires up the modal UI
initStatusMenu();

// Connection banner
const headerEl = queryOrThrow<HTMLElement>(".workspace-name");
initConnectionBanner(headerEl);
initConnectionListeners();

// ─── Realtime channel handle ──────────────────────────────────────────────────

let activeRealtimeChannel: RealtimeChannel | null = null;

// ─── Channel switching ────────────────────────────────────────────────────────

async function activateChannel(channelId: string): Promise<void> {
  if (activeRealtimeChannel) {
    await activeRealtimeChannel.unsubscribe();
    activeRealtimeChannel = null;
  }

  switchChannel(channelId);

  const ch = state.channels.find((c) => c.id === channelId);
  if (ch) {
    if (refs.channelTitle) refs.channelTitle.textContent = ch.name;
    if (mobileTitle)        mobileTitle.textContent       = ch.name;
  }

  document.querySelectorAll<HTMLElement>(".channel-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.channelId === channelId);
  });

  closeSidebar();

  await loadHistoricalMessages(refs);
  await loadReactions(refs);
  refreshPinnedBanner();

  activeRealtimeChannel = initializeRealtimeListener(refs);

  activeRealtimeChannel.subscribe((status, err) => {
    updateFromRealtimeStatus(status);
    if (err) console.error("[realtime] error:", err.message);
  });
}

// ─── Send handler ─────────────────────────────────────────────────────────────

async function handleSend(): Promise<void> {
  const capturedText = refs.messageInput.value;
  if (!capturedText.trim()) return;

  const replySnapshot = state.replyingTo
    ? {
        id:           state.replyingTo.id,
        sender_name:  state.replyingTo.sender_name,
        message_text: state.replyingTo.message_text,
      }
    : null;

  if (state.replyingTo) clearReply();

  await runSendLifecycle({
    input:  refs.messageInput,
    button: refs.sendButton,
    doSend: () => sendMessage(capturedText, refs, replySnapshot ?? undefined),
  });
}

// ─── Event listeners ──────────────────────────────────────────────────────────

refs.sendButton.addEventListener("click", () => void handleSend());

refs.messageInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void handleSend();
  }
});

refs.messageInput.addEventListener("input", () => {
  autoResizeTextarea(refs.messageInput);
});

document
  .querySelectorAll<HTMLElement>(".channel-item[data-channel-id]")
  .forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.channelId;
      if (id) void activateChannel(id);
    });
  });

// ─── Event delegation: react + reply buttons ─────────────────────────────────

refs.messageStream.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement;

  const reactBtn = target.closest<HTMLButtonElement>(".react-btn");
  if (reactBtn) {
    e.stopPropagation();
    const msgId = reactBtn.closest<HTMLElement>(".msg-actions")?.dataset.msgId;
    if (msgId) openReactionPicker(msgId, reactBtn);
    return;
  }

  const replyBtn = target.closest<HTMLButtonElement>(".reply-btn");
  if (replyBtn) {
    e.stopPropagation();
    const msgId = replyBtn.closest<HTMLElement>(".msg-actions")?.dataset.msgId;
    if (msgId) {
      const msg = state.activeMessages.find((m) => m.id === msgId);
      if (msg) setReplyTo(msg, refs);
    }
    return;
  }
});

// ─── Pinned banner ────────────────────────────────────────────────────────────

function refreshPinnedBanner(): void {
  const banner      = document.getElementById("pinnedBanner")      as HTMLElement | null;
  const bannerText  = document.getElementById("pinnedBannerText")  as HTMLElement | null;
  const bannerCount = document.getElementById("pinnedCount")       as HTMLElement | null;
  const bannerClose = document.getElementById("pinnedBannerClose") as HTMLButtonElement | null;

  if (!banner || !bannerText || !bannerCount) return;

  const ids = state.pinnedMessages;

  if (!ids.length) {
    banner.style.display = "none";
    return;
  }

  const first   = state.activeMessages.find((m) => ids.includes(m.id));
  const preview = first
    ? `${first.sender_name}: ${first.message_text
        .replace(/```[\s\S]*?```/g, "[code]")
        .replace(/`([^`]+)`/g, "$1")
        .slice(0, 60)}`
    : "Pinned message";

  bannerText.textContent  = preview;
  bannerCount.textContent = ids.length > 1 ? `+${ids.length - 1} more` : "";
  banner.style.display    = "flex";

  banner.onclick = () => {
    if (!first) return;
    const el = refs.messageStream.querySelector<HTMLElement>(
      `[data-message-id="${first.id}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  bannerClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    banner.style.display = "none";
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Load any channels that were previously created and saved to Supabase,
// then activate the default channel.

async function bootstrap(): Promise<void> {
  await loadPersistedChannels(activateChannel);
  await activateChannel(state.activeChannelId);
}

void bootstrap();