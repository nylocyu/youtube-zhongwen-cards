// Shared, non-secret config module. Loaded by background.js (importScripts),
// by options.html (<script>), and require()-able from Node tests.

const STORAGE_KEY = "zwc_settings";

const DEFAULTS = Object.freeze({
  supadataApiKey: "",
  anthropicApiKey: "",
  defaultLevel: 3, // HSK level 1-7 (7 = merged advanced 7-9 band)
  defaultScript: "simplified", // "simplified" | "traditional"
  defaultCount: 20, // 10-50
  defaultSentences: false, // add an example sentence (+ its pinyin/translation) per card
  uiLanguage: "de", // "de" | "en" — also the language cards get translated into
});

const MIN_LEVEL = 1;
const MAX_LEVEL = 7;
const MIN_COUNT = 10;
const MAX_COUNT = 50;

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Single source of truth for turning any stored/incoming settings object
// into a safe, complete one. Called on both read and save.
function normalize(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    supadataApiKey: typeof src.supadataApiKey === "string" ? src.supadataApiKey.trim() : "",
    anthropicApiKey: typeof src.anthropicApiKey === "string" ? src.anthropicApiKey.trim() : "",
    defaultLevel: clampInt(src.defaultLevel, MIN_LEVEL, MAX_LEVEL, DEFAULTS.defaultLevel),
    defaultScript: src.defaultScript === "traditional" ? "traditional" : "simplified",
    defaultCount: clampInt(src.defaultCount, MIN_COUNT, MAX_COUNT, DEFAULTS.defaultCount),
    defaultSentences: src.defaultSentences === true,
    uiLanguage: src.uiLanguage === "en" ? "en" : "de",
  };
}

function hasRequiredKeys(settings) {
  return Boolean(settings.supadataApiKey && settings.anthropicApiKey);
}

const ZWC_SETTINGS = {
  STORAGE_KEY,
  DEFAULTS,
  MIN_LEVEL,
  MAX_LEVEL,
  MIN_COUNT,
  MAX_COUNT,
  normalize,
  hasRequiredKeys,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZWC_SETTINGS;
}
if (typeof globalThis !== "undefined") {
  globalThis.ZWC_SETTINGS = ZWC_SETTINGS;
}
