// Content script: injects a "Vokabeln" button into YouTube's action row
// (next to Like/Share) that opens the side panel. Re-injects on YouTube's
// own SPA navigation, since YouTube only fires a real page load once.

const BUTTON_ID = "zwc-open-button";
const ACTION_ROW_SELECTOR = "#top-level-buttons-computed";

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

// YouTube renders duplicate hidden (0x0) copies of the action row for its
// responsive layout breakpoints — only the visible one should get the button.
function findActionRowHost() {
  const candidates = Array.from(document.querySelectorAll(ACTION_ROW_SELECTOR));
  return candidates.find(isVisible) || null;
}

function createButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "词 Vokabeln";
  button.title = "Chinesisch-Vokabelkarten aus diesem Video erstellen";
  button.style.cssText =
    "margin-left:8px;padding:0 16px;height:36px;border-radius:18px;border:none;" +
    "background:var(--yt-spec-badge-chip-background,#f2f2f2);color:var(--yt-spec-text-primary,#0f0f0f);" +
    "font:inherit;font-weight:500;font-size:14px;cursor:pointer;white-space:nowrap;";
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openSidePanel" });
  });
  return button;
}

function injectButton() {
  const host = findActionRowHost();
  if (!host) return;

  const existing = document.getElementById(BUTTON_ID);
  if (existing) {
    if (existing.parentElement !== host) {
      existing.remove();
      host.appendChild(existing);
    }
    return;
  }

  // Clean up any stray duplicates left over from a rebuilt action row.
  document.querySelectorAll(`#${BUTTON_ID}`).forEach((el) => el.remove());
  host.appendChild(createButton());
}

let reconcileTimer = null;
function scheduleReconcile(delay = 80) {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(injectButton, delay);
}

function isWatchPage() {
  return location.pathname === "/watch";
}

function init() {
  if (isWatchPage()) injectButton();
}

const observer = new MutationObserver(() => scheduleReconcile());
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("resize", () => scheduleReconcile(120));

// YouTube is a single-page app; it fires this custom event after an
// in-page navigation to a different video, not a real page (re)load.
document.addEventListener("yt-navigate-finish", () => {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) existing.remove();
  if (isWatchPage()) scheduleReconcile(500);
});

init();
