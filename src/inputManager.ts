// ─── inputManager.ts — Input field lifecycle management ──────────────────────
//
// Centralises all state transitions for the message input and send button:
//   idle  →  pending  →  idle (success)
//                     →  error  →  idle (after timeout)
//
// Keeping this in one place means neither main.ts nor supabaseMessages.ts
// need to know anything about CSS classes or timing constants.

export type InputState = "idle" | "pending" | "error";

/** How long (ms) to display the error tint before resetting to idle. */
const ERROR_RESET_DELAY_MS = 2500;

/** Minimum ms the input stays locked after Send — prevents double-submit
 *  even on sub-50ms round trips where the button hasn't visually updated yet. */
const MIN_LOCK_DURATION_MS = 300;

// ─── Core transition function ─────────────────────────────────────────────────

/**
 * Transitions the input + button pair to a new visual state.
 * All DOM mutations live here; call sites only name the state.
 */
export function setInputState(
  input: HTMLTextAreaElement,
  button: HTMLButtonElement,
  nextState: InputState
): void {
  switch (nextState) {
    case "pending":
      input.disabled  = true;
      button.disabled = true;
      button.style.opacity  = "0.45";
      button.style.transform = "scale(0.92)";
      input.classList.add("input--pending");
      input.classList.remove("input--error");
      break;

    case "error":
      input.disabled  = false;
      button.disabled = false;
      button.style.opacity  = "1";
      button.style.transform = "";
      input.classList.add("input--error");
      input.classList.remove("input--pending");
      break;

    case "idle":
    default:
      input.disabled  = false;
      button.disabled = false;
      button.style.opacity  = "1";
      button.style.transform = "";
      input.classList.remove("input--pending", "input--error");
      break;
  }
}

// ─── Send lifecycle orchestrator ──────────────────────────────────────────────

export interface SendLifecycleOptions {
  input:  HTMLTextAreaElement;
  button: HTMLButtonElement;
  /**
   * The actual async send operation.
   * Should resolve true on success, false on failure.
   */
  doSend: () => Promise<boolean>;
  /** Called immediately after the input is cleared (for optimistic render). */
  onOptimisticClear?: (capturedText: string) => void;
}

/**
 * Manages the full send lifecycle:
 *   1. Captures and clears the input text immediately
 *   2. Locks the UI (pending state) for at least MIN_LOCK_DURATION_MS
 *   3. Calls doSend()
 *   4. On success → returns to idle
 *   5. On failure → enters error state, restores text, auto-resets after delay
 *
 * Returns true if the send succeeded, false otherwise.
 */
export async function runSendLifecycle(
  opts: SendLifecycleOptions
): Promise<boolean> {
  const { input, button, doSend, onOptimisticClear } = opts;

  const capturedText = input.value;
  if (!capturedText.trim()) return false;

  // ── 1. Clear and focus immediately — snappy UX ────────────────────────────
  input.value = "";
  input.style.height = "auto";

  // ── 2. Lock UI ────────────────────────────────────────────────────────────
  setInputState(input, button, "pending");

  // Notify caller so it can kick off optimistic rendering before the await
  onOptimisticClear?.(capturedText);

  // ── 3. Enforce minimum lock duration in parallel with the network call ────
  const [success] = await Promise.all([
    doSend(),
    new Promise<void>((r) => setTimeout(r, MIN_LOCK_DURATION_MS)),
  ]);

  // ── 4/5. Transition to idle or error ─────────────────────────────────────
  if (success) {
    setInputState(input, button, "idle");
    input.focus();
    return true;
  } else {
    setInputState(input, button, "error");
    // Restore text so the user can retry without retyping
    input.value = capturedText;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    input.focus();
    // Auto-reset after the error display window
    setTimeout(() => {
      setInputState(input, button, "idle");
    }, ERROR_RESET_DELAY_MS);
    return false;
  }
}

// ─── Auto-resize helper (kept here since it's pure input housekeeping) ────────

/**
 * Clamps the textarea height to its content, up to maxHeight px.
 * Call on every 'input' event.
 */
export function autoResizeTextarea(
  input: HTMLTextAreaElement,
  maxHeight = 120
): void {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";
}
