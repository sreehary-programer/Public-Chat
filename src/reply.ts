import { state } from "./state.js";
import type { ChatMessage, DOMRefs } from "./types.js";

let replyBar: HTMLElement;
let replyBarText: HTMLElement;
let replyBarCancel: HTMLButtonElement;

export function initReply(refs: DOMRefs): void {
  replyBar = document.getElementById("replyBar") as HTMLElement;
  replyBarText = document.getElementById("replyBarText") as HTMLElement;
  replyBarCancel = document.getElementById(
    "replyBarCancel"
  ) as HTMLButtonElement;

  if (!replyBar || !replyBarText || !replyBarCancel) {
    throw new Error("Reply UI elements not found");
  }

  replyBarCancel.addEventListener("click", clearReply);
}

export function setReplyTo(
  msg: ChatMessage,
  refs: DOMRefs
): void {
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

export function clearReply(): void {
  state.replyingTo = null;
  replyBar.classList.remove("visible");
}