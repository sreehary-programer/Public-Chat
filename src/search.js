import { state } from "./state.js";
import { escapeHtml, formatTime } from "./render.js";
export function initSearch(refs, closeSidebar) {
    const searchOverlayEl = document.getElementById("searchOverlay");
    if (!(searchOverlayEl instanceof HTMLDivElement)) {
        throw new Error("searchOverlay not found");
    }
    const searchOverlay = searchOverlayEl;
    const searchInputEl = document.getElementById("searchInput");
    if (!(searchInputEl instanceof HTMLInputElement)) {
        throw new Error("searchInput not found");
    }
    const searchInput = searchInputEl;
    const searchResultsEl = document.getElementById("searchResults");
    if (!(searchResultsEl instanceof HTMLDivElement)) {
        throw new Error("searchResults not found");
    }
    const searchResults = searchResultsEl;
    const closeSearchBtn = document.getElementById("closeSearch");
    const emojiPicker = document.getElementById("emojiPicker");
    if (!searchOverlay ||
        !searchInput ||
        !searchResults ||
        !closeSearchBtn) {
        return;
    }
    function openSearch() {
        searchOverlay.classList.add("open");
        searchInput.value = "";
        searchResults.innerHTML = "";
        searchInput.focus();
    }
    function closeSearch() {
        searchOverlay.classList.remove("open");
    }
    document
        .querySelectorAll(".search-trigger")
        .forEach((btn) => {
        btn.addEventListener("click", openSearch);
    });
    closeSearchBtn.addEventListener("click", closeSearch);
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        searchResults.innerHTML = "";
        if (!q)
            return;
        const matches = state.activeMessages.filter((m) => m.message_text.toLowerCase().includes(q));
        if (!matches.length) {
            searchResults.innerHTML =
                `<div class="search-empty">
          No messages match "<strong>${escapeHtml(q)}</strong>"
        </div>`;
            return;
        }
        matches.forEach((msg) => {
            const highlighted = escapeHtml(msg.message_text
                .replace(/```[\s\S]*?```/g, "[code]")
                .slice(0, 120)).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (match) => `<mark>${match}</mark>`);
            const item = document.createElement("div");
            item.className = "search-result-item";
            item.innerHTML = `
        <span class="search-result-sender">
          ${escapeHtml(msg.sender_name)}
          ·
          <span style="font-weight:400;color:#505a6e">
            ${formatTime(msg.created_at)}
          </span>
        </span>

        <span class="search-result-text">
          ${highlighted}
        </span>
      `;
            item.addEventListener("click", () => {
                closeSearch();
                const el = refs.messageStream.querySelector(`[data-message-id="${msg.id}"]`);
                el?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            });
            searchResults.appendChild(item);
        });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSearch();
            closeSidebar?.();
            emojiPicker?.classList.remove("open");
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "f") {
            e.preventDefault();
            openSearch();
        }
    });
}
