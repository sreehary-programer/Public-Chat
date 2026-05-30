import { state } from "./state.js";
import { smartScrollToBottom, scrollToBottom } from "./scroll.js";
// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}
export function formatFullDate(iso) {
    return new Date(iso).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}
export function escapeHtml(raw) {
    return raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// ─── Message text renderer (fenced code + inline code) ───────────────────────
export function renderMessageText(raw) {
    const parts = [];
    // Split on fenced code blocks: ```lang\ncode\n```
    const fenceRe = /```([^\n`]*)\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = fenceRe.exec(raw)) !== null) {
        if (m.index > last) {
            parts.push(renderInlineCode(escapeHtml(raw.slice(last, m.index))));
        }
        const lang = m[1].trim();
        const code = escapeHtml(m[2]);
        const headerHtml = lang
            ? `<div class="code-block-header"><span>${escapeHtml(lang)}</span><button class="copy-code-btn" title="Copy"><i class="ti ti-copy"></i></button></div>`
            : `<div class="code-block-header"><span>code</span><button class="copy-code-btn" title="Copy"><i class="ti ti-copy"></i></button></div>`;
        parts.push(`${headerHtml}<pre class="code-block">${code}</pre>`);
        last = fenceRe.lastIndex;
    }
    if (last < raw.length) {
        parts.push(renderInlineCode(escapeHtml(raw.slice(last))));
    }
    return parts.join("");
}
function renderInlineCode(escaped) {
    return escaped.replace(/`([^`]+)`/g, (_match, code) => `<code class="inline-code">${code}</code>`);
}
function initials(name) {
    const parts = name.split(/[\s._-]/);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
// ─── Core render function ─────────────────────────────────────────────────────
export function renderMessageBubble(msg, refs, options = {}) {
    const { scrollIntoView = true } = options;
    const isOutgoing = msg.sender_name === state.localUser;
    const safeText = renderMessageText(msg.message_text);
    const timeLabel = formatTime(msg.created_at);
    const fullDate = formatFullDate(msg.created_at);
    const avatarText = initials(msg.sender_name);
    const avatarClass = isOutgoing
        ? "avatar avatar--out"
        : `avatar avatar--in avatar--${avatarText.toLowerCase().replace(/[^a-z]/g, "")}`;
    const bubbleClass = isOutgoing ? "bubble bubble--out" : "bubble bubble--in";
    // ── Reply preview (if message has a replyTo snapshot) ─────────────────────
    const replyPreviewHtml = msg.replyTo
        ? `<div class="reply-preview">
         <span class="reply-sender">${escapeHtml(msg.replyTo.sender_name)}</span>
         <span class="reply-text">${escapeHtml(msg.replyTo.message_text.slice(0, 80))}</span>
       </div>`
        : "";
    // ── Hover action toolbar ───────────────────────────────────────────────────
    const actionsHtml = `
    <div class="msg-actions" data-msg-id="${escapeHtml(msg.id)}">
      <button class="msg-action-btn react-btn"  title="Add reaction"><i class="ti ti-mood-smile"></i></button>
      <button class="msg-action-btn reply-btn"  title="Reply"><i class="ti ti-corner-up-left"></i></button>
    </div>`;
    const metaInner = isOutgoing
        ? `<span class="msg-time" title="${escapeHtml(fullDate)}">${timeLabel}</span>
       <span class="msg-sender">${escapeHtml(msg.sender_name)}</span>
       <div class="${avatarClass}">${avatarText}</div>`
        : `<div class="${avatarClass}">${avatarText}</div>
       <span class="msg-sender">${escapeHtml(msg.sender_name)}</span>
       <span class="msg-time" title="${escapeHtml(fullDate)}">${timeLabel}</span>`;
    const html = `
    <div class="msg-group ${isOutgoing ? "msg-group--out" : "msg-group--in"}"
         data-message-id="${escapeHtml(msg.id)}"
         data-channel-id="${escapeHtml(msg.channel_id)}">
      ${actionsHtml}
      <div class="msg-meta">${metaInner}</div>
      <div class="${bubbleClass}">${replyPreviewHtml}${safeText}</div>
    </div>`;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    const node = wrapper.firstElementChild;
    // ── Wire up copy buttons for code blocks ───────────────────────────────────
    node.querySelectorAll(".copy-code-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const pre = btn.closest(".code-block-header")?.nextElementSibling;
            if (pre) {
                navigator.clipboard.writeText(pre.textContent ?? "").catch(() => { });
                btn.innerHTML = `<i class="ti ti-check"></i>`;
                setTimeout(() => { btn.innerHTML = `<i class="ti ti-copy"></i>`; }, 1500);
            }
        });
    });
    refs.messageStream.appendChild(node);
    if (scrollIntoView) {
        smartScrollToBottom(refs.messageStream, {
            force: isOutgoing,
            behavior: "smooth",
        });
    }
    return node;
}
// ─── Full channel render ──────────────────────────────────────────────────────
export function renderAllMessages(refs) {
    refs.messageStream.classList.add("no-animate");
    refs.messageStream.innerHTML = "";
    for (const msg of state.activeMessages) {
        renderMessageBubble(msg, refs, { scrollIntoView: false });
    }
    scrollToBottom(refs.messageStream, { behavior: "auto" });
    requestAnimationFrame(() => {
        refs.messageStream.classList.remove("no-animate");
    });
}
