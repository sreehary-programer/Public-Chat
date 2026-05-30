import { autoResizeTextarea } from "./inputManager.js";
import type { DOMRefs } from "./types.js";

const EMOJI_CATS: Record<string, string[]> = {
  Smileys: ["😀", "😃", "😄"],
  People: ["👋", "👍", "🙏"],
  Symbols: ["❤️", "🔥", "💯"],
};

export function initEmojiPicker(refs: DOMRefs): void {
  const emojiPicker =
    document.getElementById("emojiPicker") as HTMLDivElement;

  const emojiToggleBtn =
    document.getElementById("emojiToggleBtn") as HTMLButtonElement | null;

const emojiSearch =
  document.getElementById("emojiSearch") as HTMLInputElement;

if (!emojiSearch) {
  throw new Error("emojiSearch not found");
}
  const emojiGrid =
  document.getElementById("emojiGrid") as HTMLDivElement;

  const emojiCats =
    document.getElementById("emojiCats") as HTMLDivElement;

  if (
    !emojiPicker ||
    !emojiToggleBtn ||
    !emojiSearch ||
    !emojiGrid ||
    !emojiCats
  ) {
    return;
  }

  let currentEmojiCat = Object.keys(EMOJI_CATS)[0];

  function renderEmojiGrid(emojis: string[]): void {
    emojiGrid.innerHTML = "";

    emojis.forEach((emoji) => {
      const btn = document.createElement("button");

      btn.className = "emoji-btn";
      btn.textContent = emoji;

      btn.addEventListener("click", () => {
        insertEmoji(emoji);
      });

      emojiGrid.appendChild(btn);
    });
  }

  function buildEmojiCats(): void {
    emojiCats.innerHTML = "";

    Object.keys(EMOJI_CATS).forEach((cat) => {
      const btn = document.createElement("button");

      btn.className =
        "emoji-cat-btn" +
        (cat === currentEmojiCat ? " active" : "");

      btn.textContent = cat;

      btn.addEventListener("click", () => {
        currentEmojiCat = cat;

        document
          .querySelectorAll<HTMLElement>(".emoji-cat-btn")
          .forEach((b) => b.classList.remove("active"));

        btn.classList.add("active");

        renderEmojiGrid(EMOJI_CATS[cat]);
      });

      emojiCats.appendChild(btn);
    });
  }

  function insertEmoji(emoji: string): void {
    const input = refs.messageInput;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    input.value =
      input.value.slice(0, start) +
      emoji +
      input.value.slice(end);

    input.selectionStart =
      input.selectionEnd =
        start + emoji.length;

    input.focus();

    autoResizeTextarea(input);
  }

  function openEmojiPicker(): void {
    emojiPicker.classList.toggle("open");

    if (emojiPicker.classList.contains("open")) {
      buildEmojiCats();

      renderEmojiGrid(
        EMOJI_CATS[currentEmojiCat]
      );

      emojiSearch.value = "";
      emojiSearch.focus();
    }
  }

  emojiToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openEmojiPicker();
  });

  emojiSearch.addEventListener("input", () => {
    const q = emojiSearch.value
      .toLowerCase()
      .trim();

    if (!q) {
      renderEmojiGrid(
        EMOJI_CATS[currentEmojiCat]
      );
      return;
    }

    const all = Object.values(EMOJI_CATS).flat();

    renderEmojiGrid(all.slice(0, 60));
  });

  document.addEventListener("click", (e) => {
    const target = e.target as Node;

    if (
      !emojiPicker.contains(target) &&
      target !== emojiToggleBtn
    ) {
      emojiPicker.classList.remove("open");
    }
  });
}