const STORAGE_KEY = "boston-ball:intro:v1";

export function introStorageKey() {
  return STORAGE_KEY;
}

export function hasSeenIntro() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "seen");
  } catch {
    // The intro can still be dismissed when storage is unavailable.
  }
}

export function resetIntro() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export class IntroCutscene {
  constructor() {
    this.root = document.querySelector("#intro");
    this.active = false;
    this.root.addEventListener("click", () => this.dismiss());
  }

  start() {
    this.active = true;
    document.body.classList.add("intro-active");
    this.root.classList.add("visible");
    this.root.setAttribute("aria-hidden", "false");
  }

  dismiss() {
    if (!this.active) return;
    this.active = false;
    markIntroSeen();
    document.body.classList.remove("intro-active");
    this.root.classList.remove("visible");
    this.root.setAttribute("aria-hidden", "true");
  }
}
