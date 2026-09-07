// Shared bilingual (de/en) string dictionary. Loaded by sidepanel.html and
// options.html (<script>), as a content script alongside content.js, and
// require()-able from Node tests. NOT loaded by background.js — the service
// worker stays language-agnostic and only ever returns typed error codes;
// all human-readable text resolution happens here, in the UI-facing contexts.

const STRINGS = {
  de: {
    // Sidepanel — static labels
    settingsTitle: "Einstellungen",
    welcomeText: "Öffne ein YouTube-Video mit Untertiteln, um Chinesisch-Vokabelkarten zu erstellen.",
    missingKeysText: "Bitte hinterlege zuerst deinen Supadata- und Anthropic-API-Key in den Einstellungen.",
    openOptionsButton: "Einstellungen öffnen",
    hskLevelLabel: "HSK-Level",
    scriptLabel: "Schrift",
    scriptSimplified: "简体 Vereinfacht",
    scriptTraditional: "繁體 Traditionell",
    countLabel: "Anzahl Vokabeln:",
    sentencesLabel: "Beispielsätze hinzufügen",
    sentencesHint:
      "Bei chinesischen Videos stammen die Sätze wörtlich aus dem Video, sonst werden sie passend zum Thema generiert.",
    generateButton: "Vokabeln generieren",
    loadingGeneric: "Wird geladen…",
    tableHeaderTranslation: "Deutsch",
    exportButton: "Als TSV exportieren",
    regenerateButton: "Neu generieren",
    backButton: "Zurück",

    // Sidepanel — dynamic templates
    loadingTranscript: "Transkript wird geladen…",
    loadingVocab: "Vokabeln werden ausgewählt und übersetzt…",
    resultsSummary: "{count} Vokabeln ({caseLabel})",
    caseLabelTranscript: "aus dem Transkript",
    caseLabelTopic: "thematisch generiert",
    tsvFilename: "chinesisch-vokabeln-{videoId}-HSK{level}-{count}.tsv",
    requestTimeout: "Zeitüberschreitung bei der Anfrage.",

    // Error codes (background.js only ever returns the code; the message
    // text is always resolved here, client-side)
    "error.MISSING_SUPADATA_KEY": "Kein Supadata API-Key hinterlegt.",
    "error.MISSING_AI_KEY": "Kein Anthropic API-Key hinterlegt.",
    "error.INVALID_SUPADATA_KEY": "Der Supadata API-Key ist ungültig.",
    "error.INVALID_AI_KEY": "Der Anthropic API-Key ist ungültig.",
    "error.NO_TRANSCRIPT": "Für dieses Video ist kein Transkript verfügbar.",
    "error.VIDEO_NOT_FOUND": "Video nicht gefunden oder privat.",
    "error.RATE_LIMITED": "Supadata Rate-Limit erreicht — versuche es später erneut.",
    "error.AI_RATE_LIMITED": "Anthropic Rate-Limit erreicht — versuche es später erneut.",
    "error.NOT_A_VIDEO": "Kein YouTube-Video in diesem Tab geöffnet.",
    "error.NO_MATCHES": "Keine passenden Vokabeln auf diesem Level im Transkript gefunden.",
    "error.NO_CARDS": "Es konnten keine gültigen Vokabelkarten erzeugt werden.",
    "error.NO_TAB": "Kein aktiver Tab gefunden.",
    "error.SUPADATA_ERROR": "Supadata-Anfrage fehlgeschlagen.",
    "error.SUPADATA_TIMEOUT": "Supadata-Anfrage hat zu lange gedauert.",
    "error.UNKNOWN": "Unbekannter Fehler.",
    "error.INVALID_VIDEO_ID": "Ungültige Video-ID.",
    "error.AI_RESPONSE_TOO_LARGE": "Die KI-Antwort war zu groß.",
    "error.AI_IDLE_TIMEOUT": "Die KI-Anfrage wurde wegen Inaktivität abgebrochen.",
    "error.AI_HARD_TIMEOUT": "Die KI-Anfrage hat zu lange gedauert.",
    "error.AI_NETWORK_ERROR": "Netzwerkfehler bei der KI-Anfrage.",
    "error.AI_REQUEST_FAILED": "Die KI-Anfrage ist fehlgeschlagen.",
    "error.AI_BAD_RESPONSE": "Die KI-Antwort konnte nicht verarbeitet werden.",

    // Options page
    optionsTitleSuffix: "Einstellungen",
    apiKeysHint:
      "Diese Extension nutzt zwei eigene API-Keys: Supadata für YouTube-Transkripte und Anthropic (Claude) für Übersetzung und Themenauswahl. Beides bleibt lokal auf diesem Gerät gespeichert — kein eigener Server, keine Analyse, keine Weitergabe.",
    supadataKeyLabel: "Supadata API-Key",
    supadataKeyLinkText: "Supadata-Key erstellen ↗",
    anthropicKeyLabel: "Anthropic API-Key",
    anthropicKeyLinkText: "Anthropic-Key erstellen ↗",
    baseLanguageLabel: "Ausgangssprache",
    defaultsHeading: "Standardwerte",
    countRangeLabel: "Anzahl Vokabeln (10–50)",
    saveButton: "Speichern",
    savedStatus: "Gespeichert.",

    // Content script (injected YouTube button)
    contentButtonLabel: "词 Vokabeln",
    contentButtonTitle: "Chinesisch-Vokabelkarten aus diesem Video erstellen",
  },
  en: {
    settingsTitle: "Settings",
    welcomeText: "Open a YouTube video with captions to create Chinese vocabulary flashcards.",
    missingKeysText: "Please add your Supadata and Anthropic API keys in the settings first.",
    openOptionsButton: "Open settings",
    hskLevelLabel: "HSK Level",
    scriptLabel: "Script",
    scriptSimplified: "简体 Simplified",
    scriptTraditional: "繁體 Traditional",
    countLabel: "Number of words:",
    sentencesLabel: "Add example sentences",
    sentencesHint:
      "For Chinese videos the sentences are taken verbatim from the video; otherwise they are generated to match the topic.",
    generateButton: "Generate vocabulary",
    loadingGeneric: "Loading…",
    tableHeaderTranslation: "English",
    exportButton: "Export as TSV",
    regenerateButton: "Regenerate",
    backButton: "Back",

    loadingTranscript: "Loading transcript…",
    loadingVocab: "Selecting and translating vocabulary…",
    resultsSummary: "{count} words ({caseLabel})",
    caseLabelTranscript: "from the transcript",
    caseLabelTopic: "topic-generated",
    tsvFilename: "chinese-vocab-{videoId}-HSK{level}-{count}.tsv",
    requestTimeout: "The request timed out.",

    "error.MISSING_SUPADATA_KEY": "No Supadata API key configured.",
    "error.MISSING_AI_KEY": "No Anthropic API key configured.",
    "error.INVALID_SUPADATA_KEY": "The Supadata API key is invalid.",
    "error.INVALID_AI_KEY": "The Anthropic API key is invalid.",
    "error.NO_TRANSCRIPT": "No transcript is available for this video.",
    "error.VIDEO_NOT_FOUND": "Video not found or private.",
    "error.RATE_LIMITED": "Supadata rate limit reached — try again later.",
    "error.AI_RATE_LIMITED": "Anthropic rate limit reached — try again later.",
    "error.NOT_A_VIDEO": "No YouTube video open in this tab.",
    "error.NO_MATCHES": "No matching vocabulary found at this level in the transcript.",
    "error.NO_CARDS": "No valid vocabulary cards could be generated.",
    "error.NO_TAB": "No active tab found.",
    "error.SUPADATA_ERROR": "The Supadata request failed.",
    "error.SUPADATA_TIMEOUT": "The Supadata request timed out.",
    "error.UNKNOWN": "Unknown error.",
    "error.INVALID_VIDEO_ID": "Invalid video ID.",
    "error.AI_RESPONSE_TOO_LARGE": "The AI response was too large.",
    "error.AI_IDLE_TIMEOUT": "The AI request timed out due to inactivity.",
    "error.AI_HARD_TIMEOUT": "The AI request took too long.",
    "error.AI_NETWORK_ERROR": "Network error during the AI request.",
    "error.AI_REQUEST_FAILED": "The AI request failed.",
    "error.AI_BAD_RESPONSE": "The AI response could not be processed.",

    optionsTitleSuffix: "Settings",
    apiKeysHint:
      "This extension uses two API keys of your own: Supadata for YouTube transcripts and Anthropic (Claude) for translation and topic selection. Both stay stored locally on this device — no server of ours, no analytics, no forwarding.",
    supadataKeyLabel: "Supadata API key",
    supadataKeyLinkText: "Create a Supadata key ↗",
    anthropicKeyLabel: "Anthropic API key",
    anthropicKeyLinkText: "Create an Anthropic key ↗",
    baseLanguageLabel: "Base language",
    defaultsHeading: "Defaults",
    countRangeLabel: "Number of words (10–50)",
    saveButton: "Save",
    savedStatus: "Saved.",

    contentButtonLabel: "词 Vocab",
    contentButtonTitle: "Create Chinese vocabulary flashcards from this video",
  },
};

function substitute(template, params) {
  let result = template;
  for (const [key, value] of Object.entries(params || {})) {
    result = result.split(`{${key}}`).join(String(value));
  }
  return result;
}

// Never throws on a missing key — falls back to German, then the bare key
// itself, so a typo shows up as visibly wrong text rather than crashing the UI.
function t(lang, key, params) {
  const dict = STRINGS[lang] || STRINGS.de;
  const template = dict[key] ?? STRINGS.de[key] ?? key;
  return substitute(template, params);
}

function applyI18n(root, lang) {
  if (typeof document !== "undefined" && root === document) {
    document.documentElement.lang = lang;
  }
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(lang, el.dataset.i18nTitle);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(lang, el.dataset.i18nPlaceholder);
  });
}

const ZWC_I18N = { STRINGS, t, applyI18n };

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZWC_I18N;
}
if (typeof globalThis !== "undefined") {
  globalThis.ZWC_I18N = ZWC_I18N;
}
