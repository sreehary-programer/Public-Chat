// ─── scroll.ts — Auto-scroll utility ─────────────────────────────────────────
//
// Owns the single question: "should we scroll down, and how?"
//
// The core insight is that we should NOT blindly scroll to the bottom on every
// new message — that would yank the user away if they've scrolled up to read
// history. We only auto-scroll when the user is already near the bottom
// (within SCROLL_THRESHOLD px), which is the same heuristic used by Slack,
// Discord, and most production chat clients.

/** Pixels from the bottom within which we consider the user "at the bottom". */
const SCROLL_THRESHOLD = 80;

/**
 * Returns true if the stream container is scrolled close enough to the bottom
 * that an incoming message should trigger an auto-scroll.
 *
 * Formula: scrollTop + clientHeight >= scrollHeight - threshold
 *   scrollHeight  = total content height (including overflow)
 *   clientHeight  = visible viewport height of the element
 *   scrollTop     = pixels already scrolled from the top
 */
export function isScrolledNearBottom(container: HTMLElement): boolean {
  const distanceFromBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceFromBottom <= SCROLL_THRESHOLD;
}

/**
 * Smoothly scrolls the message stream to the very bottom.
 * Uses scrollTo with behavior:'smooth' for a polished slide-in feel.
 * Falls back to instant scroll if the browser doesn't support smooth scrolling
 * (checked via CSS.supports — relevant for older WebViews).
 */
export function scrollToBottom(
  container: HTMLElement,
  opts: { behavior?: ScrollBehavior } = {}
): void {
  const behavior: ScrollBehavior =
    opts.behavior ??
    (CSS.supports("scroll-behavior", "smooth") ? "smooth" : "auto");

  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
}

/**
 * Smart scroll: only scrolls if the user was already near the bottom.
 * Pass force:true to override the proximity check (e.g. on channel switch
 * or when the local user sends a message).
 */
export function smartScrollToBottom(
  container: HTMLElement,
  opts: { force?: boolean; behavior?: ScrollBehavior } = {}
): void {
  const { force = false, behavior = "smooth" } = opts;

  if (force || isScrolledNearBottom(container)) {
    scrollToBottom(container, { behavior });
  }
}

// ─── Scroll-anchor sentinel ───────────────────────────────────────────────────
//
// An invisible 1px div pinned at the very end of the message stream.
// scrollIntoView on this element is more reliable than scrollTo in some
// browsers (especially when the container has dynamic content height).

let sentinel: HTMLDivElement | null = null;

/**
 * Creates and appends the scroll sentinel to the message stream container.
 * Must be called once during app bootstrap, before any messages are rendered.
 */
export function initScrollSentinel(container: HTMLElement): void {
  if (sentinel) return; // idempotent
  sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "height:1px;width:100%;pointer-events:none;";
  container.appendChild(sentinel);
}

/**
 * Scrolls the sentinel into view. More reliable than scrollTo on iOS Safari
 * and in containers with flex-column layout.
 */
export function scrollSentinelIntoView(behavior: ScrollBehavior = "smooth"): void {
  sentinel?.scrollIntoView({ behavior, block: "end" });
}
