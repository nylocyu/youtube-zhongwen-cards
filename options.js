// Options page. Falls back to localStorage so this page can also be opened
// standalone in a plain browser tab (outside the extension) for preview.

function createStorageAdapter() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    return {
      async get(key) {
        const all = await chrome.storage.local.get(key);
        return all[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
    };
  }
  return {
    async get(key) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

const storage = createStorageAdapter();

function fillForm(settings) {
  document.getElementById("supadata-key").value = settings.supadataApiKey;
  document.getElementById("anthropic-key").value = settings.anthropicApiKey;
  document.getElementById("ui-language").value = settings.uiLanguage;
  document.getElementById("default-level").value = String(settings.defaultLevel);
  document.getElementById("default-script").value = settings.defaultScript;
  document.getElementById("default-count").value = String(settings.defaultCount);
  ZWC_I18N.applyI18n(document, settings.uiLanguage);
}

function readForm() {
  return {
    supadataApiKey: document.getElementById("supadata-key").value,
    anthropicApiKey: document.getElementById("anthropic-key").value,
    uiLanguage: document.getElementById("ui-language").value,
    defaultLevel: document.getElementById("default-level").value,
    defaultScript: document.getElementById("default-script").value,
    defaultCount: document.getElementById("default-count").value,
  };
}

async function loadSettings() {
  const stored = await storage.get(ZWC_SETTINGS.STORAGE_KEY);
  return ZWC_SETTINGS.normalize(stored);
}

async function saveSettings() {
  const normalized = ZWC_SETTINGS.normalize(readForm());
  await storage.set(ZWC_SETTINGS.STORAGE_KEY, normalized);
  fillForm(normalized);

  const status = document.getElementById("save-status");
  status.textContent = ZWC_I18N.t(normalized.uiLanguage, "savedStatus");
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

async function init() {
  fillForm(await loadSettings());
  document.getElementById("save-button").addEventListener("click", saveSettings);
}

init();
