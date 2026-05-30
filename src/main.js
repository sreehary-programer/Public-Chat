import { state, switchChannel } from "./state.js";
import { loadHistoricalMessages, loadReactions, initializeRealtimeListener, sendMessage, } from "./supabaseMessages.js";
import { initEmojiPicker } from "./emojiPicker.js";
import { initScrollSentinel } from "./scroll.js";
import { runSendLifecycle, autoResizeTextarea } from "./inputManager.js";
import { initConnectionBanner, initConnectionListeners, updateFromRealtimeStatus, } from "./connectionStatus.js";
import { initStatusMenu } from "./statusMenu.js";
import { initTypingIndicator } from "./typingIndicator.js";
import { initSearch } from "./search.js";
import { initAddChannel } from "./addChannel.js";
import { initReactions, openReactionPicker } from "./reactions.js";
import { initReply, setReplyTo, clearReply } from "./reply.js";
// ─── DOM query helper ─────────────────────────────────────────────────────────
function queryOrThrow(selector, context = document) {
    const el = context.querySelector(selector);
    if (!el)
        throw new Error(`Required element not found: "${selector}"`);
    return el;
}
// ─── Typed DOM refs ───────────────────────────────────────────────────────────
const refs = {
    messageStream: queryOrThrow(".message-stream"),
    messageInput: queryOrThrow(".msg-input"),
    sendButton: queryOrThrow(".send-btn"),
    channelTitle: queryOrThrow("#desktopChannelTitle"),
};
// ─── Sidebar elements ─────────────────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const mobileTitle = document.getElementById("mobileChannelTitle");
// ─── Sidebar open / close helpers ────────────────────────────────────────────
function openSidebar() {
    sidebar?.classList.add("sidebar--open");
    sidebarOverlay?.classList.add("overlay--visible");
    document.body.style.overflow = "hidden"; // prevent body scroll while drawer open
}
function closeSidebar() {
    sidebar?.classList.remove("sidebar--open");
    sidebarOverlay?.classList.remove("overlay--visible");
    document.body.style.overflow = "";
}
openSidebarBtn?.addEventListener("click", openSidebar);
closeSidebarBtn?.addEventListener("click", closeSidebar);
sidebarOverlay?.addEventListener("click", closeSidebar);
// Close sidebar on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
        closeSidebar();
});
// ─── Phase 4 bootstrap ───────────────────────────────────────────────────────
// 1. Scroll sentinel — invisible anchor at end of stream
initScrollSentinel(refs.messageStream);
initTypingIndicator(refs);
initSearch(refs, closeSidebar);
initEmojiPicker(refs);
initReactions(refs);
initReply(refs);
initAddChannel(activateChannel);
initStatusMenu();
// 2. Connection banner — injected into the workspace name area
const headerEl = queryOrThrow(".workspace-name");
initConnectionBanner(headerEl);
// 3. Network event listeners (online/offline/visibilitychange)
initConnectionListeners();
// ─── Realtime channel handle ──────────────────────────────────────────────────
let activeRealtimeChannel = null;
// ─── Channel switching ────────────────────────────────────────────────────────
async function activateChannel(channelId) {
    if (activeRealtimeChannel) {
        await activeRealtimeChannel.unsubscribe();
        activeRealtimeChannel = null;
    }
    switchChannel(channelId);
    const ch = state.channels.find((c) => c.id === channelId);
    if (ch) {
        // Update both desktop and mobile channel titles
        if (refs.channelTitle)
            refs.channelTitle.textContent = ch.name;
        if (mobileTitle)
            mobileTitle.textContent = ch.name;
    }
    document.querySelectorAll(".channel-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.channelId === channelId);
    });
    // Close sidebar on mobile after selecting a channel
    closeSidebar();
    await loadHistoricalMessages(refs);
    await loadReactions(refs);
    refreshPinnedBanner();
    // Open new realtime channel and forward its status to the banner
    activeRealtimeChannel = initializeRealtimeListener(refs);
    activeRealtimeChannel.subscribe((status, err) => {
        updateFromRealtimeStatus(status);
        if (err)
            console.error("[realtime] error:", err.message);
    });
}
// ─── Send handler ─────────────────────────────────────────────────────────────
async function handleSend() {
    const capturedText = refs.messageInput.value;
    if (!capturedText.trim())
        return;
    // Snapshot reply context before the send clears state
    const replySnapshot = state.replyingTo
        ? { id: state.replyingTo.id, sender_name: state.replyingTo.sender_name, message_text: state.replyingTo.message_text }
        : null;
    // Clear the reply bar immediately (optimistic)
    if (state.replyingTo)
        clearReply();
    await runSendLifecycle({
        input: refs.messageInput,
        button: refs.sendButton,
        doSend: () => sendMessage(capturedText, refs, replySnapshot ?? undefined),
    });
}
// ─── Event listeners ──────────────────────────────────────────────────────────
refs.sendButton.addEventListener("click", () => void handleSend());
refs.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
    }
});
refs.messageInput.addEventListener("input", () => {
    autoResizeTextarea(refs.messageInput);
});
document
    .querySelectorAll(".channel-item[data-channel-id]")
    .forEach((el) => {
    el.addEventListener("click", () => {
        const id = el.dataset.channelId;
        if (id)
            void activateChannel(id);
    });
});
// ─── Event delegation: react + reply buttons on message bubbles ──────────────
refs.messageStream.addEventListener("click", (e) => {
    const target = e.target;
    // React button
    const reactBtn = target.closest(".react-btn");
    if (reactBtn) {
        e.stopPropagation();
        const msgId = reactBtn.closest(".msg-actions")?.dataset.msgId;
        if (msgId)
            openReactionPicker(msgId, reactBtn);
        return;
    }
    // Reply button
    const replyBtn = target.closest(".reply-btn");
    if (replyBtn) {
        e.stopPropagation();
        const msgId = replyBtn.closest(".msg-actions")?.dataset.msgId;
        if (msgId) {
            const msg = state.activeMessages.find((m) => m.id === msgId);
            if (msg)
                setReplyTo(msg, refs);
        }
        return;
    }
});
// ─── Pinned banner ────────────────────────────────────────────────────────────
function refreshPinnedBanner() {
    const banner = document.getElementById("pinnedBanner");
    const bannerText = document.getElementById("pinnedBannerText");
    const bannerCount = document.getElementById("pinnedCount");
    const bannerClose = document.getElementById("pinnedBannerClose");
    if (!banner || !bannerText || !bannerCount)
        return;
    const ids = state.pinnedMessages;
    if (!ids.length) {
        banner.style.display = "none";
        return;
    }
    // Show preview of the first pinned message
    const first = state.activeMessages.find((m) => ids.includes(m.id));
    const preview = first
        ? `${first.sender_name}: ${first.message_text.replace(/```[\s\S]*?```/g, "[code]").replace(/`([^`]+)`/g, "$1").slice(0, 60)}`
        : "Pinned message";
    bannerText.textContent = preview;
    bannerCount.textContent = ids.length > 1 ? `+${ids.length - 1} more` : "";
    banner.style.display = "flex";
    // Scroll to first pinned message on click
    banner.onclick = () => {
        if (!first)
            return;
        const el = refs.messageStream.querySelector(`[data-message-id="${first.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    bannerClose?.addEventListener("click", (e) => {
        e.stopPropagation();
        banner.style.display = "none";
    });
}
// ─── Bootstrap ───────────────────────────────────────────────────────────────
void activateChannel(state.activeChannelId);
