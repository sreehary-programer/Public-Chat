import { state } from "./state.js";
import { escapeHtml } from "./render.js";
export function initAddChannel(activateChannel) {
    const addChannelModal = document.getElementById("addChannelModal");
    const addChannelBtn = document.getElementById("addChannelBtn");
    const cancelAddChannel = document.getElementById("cancelAddChannel");
    const confirmAddChannel = document.getElementById("confirmAddChannel");
    const newChannelName = document.getElementById("newChannelName");
    const newChannelDesc = document.getElementById("newChannelDesc");
    const channelList = document.getElementById("channelList");
    if (!addChannelModal ||
        !addChannelBtn ||
        !cancelAddChannel ||
        !confirmAddChannel ||
        !channelList) {
        return;
    }
    function openAddChannelModal() {
        addChannelModal.classList.add("open");
        newChannelName.value = "";
        newChannelDesc.value = "";
        newChannelName.focus();
    }
    function closeAddChannelModal() {
        addChannelModal.classList.remove("open");
    }
    addChannelBtn.addEventListener("click", openAddChannelModal);
    cancelAddChannel.addEventListener("click", closeAddChannelModal);
    addChannelModal.addEventListener("click", (e) => {
        if (e.target === addChannelModal) {
            closeAddChannelModal();
        }
    });
    confirmAddChannel.addEventListener("click", () => {
        const name = newChannelName.value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 40);
        if (!name) {
            newChannelName.focus();
            return;
        }
        const id = `ch_${name}_${Date.now()}`;
        const desc = newChannelDesc.value.trim() || "New channel";
        state.channels.push({
            id,
            name,
            description: desc,
            unread_count: 0,
        });
        const item = document.createElement("div");
        item.className = "channel-item";
        item.dataset.channelId = id;
        item.innerHTML = `
      <i class="ti ti-hash ch-icon"></i>
      <span class="ch-label">${escapeHtml(name)}</span>
    `;
        const directLabel = channelList.querySelector(".direct-label");
        if (directLabel) {
            channelList.insertBefore(item, directLabel);
        }
        else {
            channelList.appendChild(item);
        }
        item.addEventListener("click", () => {
            activateChannel(id);
        });
        closeAddChannelModal();
        activateChannel(id);
    });
    newChannelName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            confirmAddChannel.click();
        }
        if (e.key === "Escape") {
            closeAddChannelModal();
        }
    });
}
