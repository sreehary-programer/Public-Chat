import { state } from "./state.js";
import { escapeHtml } from "./render.js";
import { supabase } from "./supabaseClient.js";

export function initAddChannel(
  activateChannel: (channelId: string) => void
): void {
  const addChannelModal  = document.getElementById("addChannelModal");
  const addChannelBtn    = document.getElementById("addChannelBtn");
  const cancelAddChannel = document.getElementById("cancelAddChannel");
  const confirmAddChannel = document.getElementById("confirmAddChannel");
  const newChannelName   = document.getElementById("newChannelName") as HTMLInputElement | null;
  const newChannelDesc   = document.getElementById("newChannelDesc") as HTMLInputElement | null;
  const channelList      = document.getElementById("channelList");

  // ── Guard: all elements must exist before wiring up any listeners ──────────
  if (
    !addChannelModal  ||
    !addChannelBtn    ||
    !cancelAddChannel ||
    !confirmAddChannel ||
    !newChannelName   ||
    !newChannelDesc   ||
    !channelList
  ) {
    console.warn("[addChannel] One or more required DOM elements are missing — feature disabled.");
    return;
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAddChannelModal(): void {
    addChannelModal!.classList.add("open");
    newChannelName!.value = "";
    newChannelDesc!.value = "";
    newChannelName!.focus();
  }

  function closeAddChannelModal(): void {
    addChannelModal!.classList.remove("open");
  }

  // ── DOM helper: render a new channel-item and attach its click listener ────

  function appendChannelItem(id: string, name: string): void {
    const item = document.createElement("div");
    item.className = "channel-item";
    item.dataset.channelId = id;
    item.innerHTML = `
      <i class="ti ti-hash ch-icon"></i>
      <span class="ch-label">${escapeHtml(name)}</span>
    `;

    const directLabel = channelList!.querySelector(".direct-label");
    if (directLabel) {
      channelList!.insertBefore(item, directLabel);
    } else {
      channelList!.appendChild(item);
    }

    item.addEventListener("click", () => activateChannel(id));
  }

  // ── Confirm: validate → persist → render → activate ───────────────────────

  confirmAddChannel.addEventListener("click", () => {
    const name = newChannelName!.value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);

    if (!name) {
      newChannelName!.focus();
      return;
    }

    const id   = `ch_${name}_${Date.now()}`;
    const desc = newChannelDesc!.value.trim() || "New channel";

    // 1. Update local state
    state.channels.push({ id, name, description: desc, unread_count: 0 });

    // 2. Persist to Supabase (fire-and-forget; local state is already updated)
    supabase
      .from("channels" as never)
      .insert([{ id, name, description: desc }] as never)
      .then(({ error }) => {
        if (error) {
          console.error("[addChannel] Failed to persist channel to DB:", error.message);
        }
      });

    // 3. Render in sidebar
    appendChannelItem(id, name);

    // 4. Close modal and switch to the new channel
    closeAddChannelModal();
    activateChannel(id);
  });

  // ── Open / close wiring ────────────────────────────────────────────────────

  addChannelBtn.addEventListener("click", openAddChannelModal);
  cancelAddChannel.addEventListener("click", closeAddChannelModal);

  // Click outside modal content to dismiss
  addChannelModal.addEventListener("click", (e) => {
    if (e.target === addChannelModal) closeAddChannelModal();
  });

  // Keyboard shortcuts inside the name field
  newChannelName.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter")  confirmAddChannel.click();
    if (e.key === "Escape") closeAddChannelModal();
  });
}

// ── Bootstrap helper: load persisted channels from DB and render them ────────
//
// Call once during app bootstrap (before activateChannel).
// Channels whose id already exists in state.channels (the hardcoded seeds)
// are skipped so there are no duplicates.

export async function loadPersistedChannels(
  activateChannel: (channelId: string) => void
): Promise<void> {
  const channelList = document.getElementById("channelList");
  if (!channelList) return;

  const { data, error } = await (supabase as ReturnType<typeof supabase.from> extends never
    ? typeof supabase
    : typeof supabase)
    .from("channels" as never)
    .select("id, name, description")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[addChannel] Could not load channels from DB:", (error as { message: string }).message);
    return;
  }

  if (!data) return;

  const existingIds = new Set(state.channels.map((c) => c.id));

  for (const row of data as { id: string; name: string; description: string }[]) {
    if (existingIds.has(row.id)) continue; // already seeded in state.ts

    state.channels.push({
      id:           row.id,
      name:         row.name,
      description:  row.description ?? "",
      unread_count: 0,
    });

    const item = document.createElement("div");
    item.className = "channel-item";
    item.dataset.channelId = row.id;
    item.innerHTML = `
      <i class="ti ti-hash ch-icon"></i>
      <span class="ch-label">${escapeHtml(row.name)}</span>
    `;

    const directLabel = channelList.querySelector(".direct-label");
    if (directLabel) {
      channelList.insertBefore(item, directLabel);
    } else {
      channelList.appendChild(item);
    }

    item.addEventListener("click", () => activateChannel(row.id));
  }
}