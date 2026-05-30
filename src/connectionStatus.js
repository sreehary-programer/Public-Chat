// ─── connectionStatus.ts — Network status banner ─────────────────────────────
//
// Monitors three signals and merges them into a single ConnectionStatus:
//
//   1. navigator.onLine (browser offline/online events)  — fast, but coarse.
//      A machine can be "online" with no route to Supabase (hotel captive
//      portal, VPN drop).  Used as the primary signal.
//
//   2. Supabase RealtimeChannel status callbacks — authoritative for the
//      WebSocket specifically.  Surfaced via the updateFromRealtimeStatus()
//      export so main.ts can pass channel status strings through.
//
//   3. document.visibilitychange — when the tab regains focus we trigger a
//      connectivity re-check so a banner that was shown while backgrounded
//      clears promptly on return.
//
// The banner itself is a thin DOM element injected into the chat header.
// State transitions drive CSS class swaps; all animation is pure CSS so
// nothing needs requestAnimationFrame.
// ─── Banner DOM ───────────────────────────────────────────────────────────────
let bannerEl = null;
let currentStatus = "connected";
/**
 * Creates the status banner element and appends it to `hostEl`.
 * The banner starts hidden (connected state); subsequent updateBanner()
 * calls reveal or update it.
 *
 * Must be called once during bootstrap.
 */
export function initConnectionBanner(hostEl) {
    if (bannerEl)
        return; // idempotent
    bannerEl = document.createElement("div");
    bannerEl.className = "conn-banner conn-banner--connected";
    bannerEl.setAttribute("role", "status");
    bannerEl.setAttribute("aria-live", "polite");
    bannerEl.innerHTML = `
    <span class="conn-dot"></span>
    <span class="conn-label">Connected</span>
  `;
    hostEl.appendChild(bannerEl);
}
// ─── Banner update ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    connected: { modifier: "conn-banner--connected", dot: "●", label: "Connected" },
    reconnecting: { modifier: "conn-banner--reconnecting", dot: "◌", label: "Reconnecting…" },
    offline: { modifier: "conn-banner--offline", dot: "○", label: "No connection" },
};
function updateBanner(next) {
    if (!bannerEl || next === currentStatus)
        return;
    currentStatus = next;
    const cfg = STATUS_CONFIG[next];
    // Swap modifier class
    bannerEl.className = `conn-banner ${cfg.modifier}`;
    bannerEl.querySelector(".conn-dot").textContent = cfg.dot;
    bannerEl.querySelector(".conn-label").textContent = cfg.label;
}
// ─── Signal sources ───────────────────────────────────────────────────────────
/** Derives the current status purely from the browser's navigator.onLine. */
function deriveFromNavigator() {
    return navigator.onLine ? "connected" : "offline";
}
/** Called by main.ts when the Supabase channel reports a status change. */
export function updateFromRealtimeStatus(realtimeStatus) {
    if (!navigator.onLine) {
        updateBanner("offline");
        return;
    }
    switch (realtimeStatus) {
        case "SUBSCRIBED":
            updateBanner("connected");
            break;
        case "CHANNEL_ERROR":
        case "TIMED_OUT":
        case "CLOSED":
            updateBanner("reconnecting");
            break;
        case "SUBSCRIBING":
            // Only show reconnecting if we weren't already connected,
            // to avoid a flash on initial load.
            if (currentStatus !== "connected")
                updateBanner("reconnecting");
            break;
        default:
            break;
    }
}
// ─── Browser event listeners ──────────────────────────────────────────────────
/**
 * Attaches window online/offline and visibilitychange listeners.
 * Call once during bootstrap after initConnectionBanner().
 */
export function initConnectionListeners() {
    window.addEventListener("online", () => {
        // navigator.onLine flipped to true, but we don't know if Supabase
        // re-subscribed yet — show "reconnecting" until the channel confirms.
        updateBanner("reconnecting");
    });
    window.addEventListener("offline", () => {
        updateBanner("offline");
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            // Re-evaluate on tab focus; real status arrives via realtime callback
            if (!navigator.onLine)
                updateBanner("offline");
        }
    });
    // Set correct initial state (handles hard reload while offline)
    updateBanner(deriveFromNavigator());
}
