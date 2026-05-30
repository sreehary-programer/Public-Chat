export function initStatusMenu(): void {
const statusMenuEl =
  document.getElementById("statusMenu");

if (!(statusMenuEl instanceof HTMLDivElement)) {
  throw new Error("statusMenu not found");
}

const userStatusEl =
  document.getElementById("userStatus");

if (!(userStatusEl instanceof HTMLElement)) {
  throw new Error("userStatus not found");
}

const avatarEl =
  document.querySelector(".avatar--out");

if (!(avatarEl instanceof HTMLElement)) {
  throw new Error("avatar element not found");
}

type StatusType =
  | "online"
  | "away"
  | "dnd"
  | "offline";

const statusConfig: Record<
  StatusType,
  {
    label: string;
    color: string;
    dot: string;
    cls: string;
  }
> = {
  online: {
    label: "online",
    color: "#3ecf8e",
    dot: "#34d399",
    cls: "",
  },

  away: {
    label: "away",
    color: "#ef9f27",
    dot: "#ef9f27",
    cls: "status-away",
  },

  dnd: {
    label: "do not disturb",
    color: "#e24b4a",
    dot: "#e24b4a",
    cls: "status-dnd",
  },

  offline: {
    label: "invisible",
    color: "#505a6e",
    dot: "#505a6e",
    cls: "status-offline",
  },
};

let currentStatus: StatusType = "online";

avatarEl.addEventListener("click", (e: MouseEvent) => {
  e.stopPropagation();

  statusMenuEl.classList.toggle("open");
});

statusMenuEl
  .querySelectorAll<HTMLElement>(".status-menu-item")
  .forEach((item) => {
    item.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();

      const status =
        item.dataset.status as StatusType | undefined;

      if (!status) return;

      currentStatus = status;

      const cfg = statusConfig[status];

      userStatusEl.textContent =
        "● " + cfg.label;

      userStatusEl.className =
        "user-status " + cfg.cls;

      statusMenuEl.classList.remove("open");
    });
  });

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as Node;

  if (
    !statusMenuEl.contains(target) &&
    target !== avatarEl
  ) {
    statusMenuEl.classList.remove("open");
  }
});
}