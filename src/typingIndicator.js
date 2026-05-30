const typingUsers = [
    "maya.r",
    "j.park",
    "sam.dev",
];
export function initTypingIndicator(refs) {
    const typingIndicatorEl = document.getElementById("typingIndicator");
    if (!(typingIndicatorEl instanceof HTMLDivElement)) {
        throw new Error("typingIndicator not found");
    }
    const typingIndicator = typingIndicatorEl;
    let typingTimer;
    function showTyping(users) {
        if (users.length === 0) {
            typingIndicator.innerHTML = "";
            return;
        }
        const names = users.join(" and ");
        const plural = users.length > 1 ? "are" : "is";
        typingIndicator.innerHTML = `
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span>${names} ${plural} typing…</span>
    `;
    }
    refs.messageInput.addEventListener("input", () => {
        if (refs.messageInput.value.length > 0 &&
            Math.random() > 0.6) {
            const user = typingUsers[Math.floor(Math.random() *
                typingUsers.length)];
            showTyping([user]);
            if (typingTimer) {
                clearTimeout(typingTimer);
            }
            typingTimer = window.setTimeout(() => {
                showTyping([]);
            }, 2000);
        }
    });
}
