// Content script: injects a "詞" button into YouTube's action
// row (next to Like/Share) that opens the side panel. Re-injects on
// YouTube's own SPA navigation, since YouTube only fires a real page load
// once.

const BUTTON_ID = "zwc-open-button";
const ACTION_ROW_SELECTOR = "#top-level-buttons-computed";

// The isolated-world content script can't read chrome.storage.local
// directly (background.js locks it to TRUSTED_CONTEXTS), so the language is
// fetched once via message at startup. Deliberate simplification: if the
// user changes the language while this tab stays open, the button keeps
// showing the language it started with until the page is reloaded — there's
// no live-update channel available to a non-trusted context.
let currentLang = "de";

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
  button.textContent = ZWC_I18N.t(currentLang, "contentButtonLabel");
  button.title = ZWC_I18N.t(currentLang, "contentButtonTitle");
  // The label is a single glyph, so the title text is also the accessible name.
  button.setAttribute("aria-label", button.title);
  button.style.cssText =
    "margin-left:8px;padding:0;width:36px;height:36px;border-radius:18px;border:none;" +
    "background:var(--yt-spec-badge-chip-background,#f2f2f2);color:var(--yt-spec-text-primary,#0f0f0f);" +
    "font:inherit;font-weight:500;font-size:16px;cursor:pointer;display:grid;place-items:center;";
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

async function loadLanguage() {
  try {
    const res = await chrome.runtime.sendMessage({ action: "getSettings" });
    if (res && res.settings && res.settings.uiLanguage === "en") {
      currentLang = "en";
    }
  } catch (e) {
    // Background worker unreachable — keep the German default.
  }
}

loadLanguage().then(() => {
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
});
