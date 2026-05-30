import { state } from "./state.js";
let replyBar;
let replyBarText;
let replyBarCancel;
export function initReply(refs) {
    replyBar = document.getElementById("replyBar");
    replyBarText = document.getElementById("replyBarText");
    replyBarCancel = document.getElementById("replyBarCancel");
    if (!replyBar || !replyBarText || !replyBarCancel) {
        throw new Error("Reply UI elements not found");
    }
    replyBarCancel.addEventListener("click", clearReply);
}
export function setReplyTo(msg, refs) {
    state.replyingTo = msg;
    const preview = msg.message_text
        .replace(/```[\s\S]*?```/g, "[code]")
        .replace(/`([^`]+)`/g, "$1")
        .slice(0, 80);
    replyBarText.textContent =
        `${msg.sender_name}: ${preview}`;
    replyBar.classList.add("visible");
    refs.messageInput.focus();
}
export function clearReply() {
    state.replyingTo = null;
    replyBar.classList.remove("visible");
}
