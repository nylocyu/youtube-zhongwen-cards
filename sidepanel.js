// Side panel state machine: welcome -> missing-keys / setup -> loading ->
// results / error. Flat top-level state, no framework.

const VIEWS = ["welcome", "missing-keys", "setup", "loading", "results", "error"];

let currentSettings = null;
let currentVideo = null; // {videoId, title, description}
let currentCards = null; // last generated cards, for TSV export
let scriptChoice = "simplified";

function currentLang() {
  return (currentSettings && currentSettings.uiLanguage) || "en";
}

function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).classList.toggle("active", v === name);
  }
}

function setLoadingPhase(text) {
  document.getElementById("loading-phase").textContent = text;
}

// Client-side watchdog: a dead/restarted service worker can otherwise leave
// this Promise pending forever.
function sendMessage(action, payload) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(ZWC_I18N.t(currentLang(), "requestTimeout"))), 130000);
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function updateScriptToggle() {
  document.querySelectorAll(".segmented-option").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.value === scriptChoice));
  });
}

function applyDefaultsToControls() {
  document.getElementById("level-select").value = String(currentSettings.defaultLevel);
  document.getElementById("count-range").value = String(currentSettings.defaultCount);
  document.getElementById("count-value").textContent = String(currentSettings.defaultCount);
  document.getElementById("sentences-checkbox").checked = currentSettings.defaultSentences;
  document.getElementById("discover-checkbox").checked = currentSettings.defaultDiscover;
  scriptChoice = currentSettings.defaultScript;
  updateScriptToggle();
}

const KEY_ERROR_CODES = new Set([
  "MISSING_SUPADATA_KEY",
  "MISSING_AI_KEY",
  "INVALID_SUPADATA_KEY",
  "INVALID_AI_KEY",
]);

function showError(response) {
  const lang = currentLang();
  const code = response && response.error;
  const message = code ? ZWC_I18N.t(lang, `error.${code}`) : (response && response.message) || ZWC_I18N.t(lang, "error.UNKNOWN");
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-options-link").hidden = !KEY_ERROR_CODES.has(code);
  showView("error");
}

function renderResults(vocabRes) {
  const lang = currentLang();
  const tbody = document.getElementById("results-tbody");
  tbody.innerHTML = "";
  for (const card of vocabRes.cards) {
    const tr = document.createElement("tr");
    const hanziTd = document.createElement("td");
    hanziTd.textContent = card.hanzi;
    const pinyinTd = document.createElement("td");
    pinyinTd.textContent = card.pinyin;
    const translationTd = document.createElement("td");
    translationTd.textContent = card.translation;
    tr.append(hanziTd, pinyinTd, translationTd);
    tbody.appendChild(tr);

    if (card.sentence) {
      const sentenceTr = document.createElement("tr");
      sentenceTr.className = "sentence-row";
      const td = document.createElement("td");
      td.colSpan = 3;
      const hanziLine = document.createElement("div");
      hanziLine.className = "sentence-hanzi";
      hanziLine.textContent = card.sentence;
      td.appendChild(hanziLine);
      for (const line of [card.sentencePinyin, card.sentenceTranslation]) {
        if (!line) continue;
        const div = document.createElement("div");
        div.textContent = line;
        td.appendChild(div);
      }
      sentenceTr.appendChild(td);
      tbody.appendChild(sentenceTr);
    }
  }
  const CASE_LABEL_KEYS = { A: "caseLabelTranscript", B: "caseLabelTopic", D: "caseLabelDiscover" };
  const caseLabelKey = CASE_LABEL_KEYS[vocabRes.caseUsed] || "caseLabelTopic";
  document.getElementById("results-summary").textContent = ZWC_I18N.t(lang, "resultsSummary", {
    count: vocabRes.cards.length,
    caseLabel: ZWC_I18N.t(lang, caseLabelKey),
  });
  showView("results");
}

async function onGenerate() {
  const lang = currentLang();
  showView("loading");
  setLoadingPhase(ZWC_I18N.t(lang, "loadingTranscript"));

  try {
    const transcriptRes = await sendMessage("fetchTranscript", { videoId: currentVideo.videoId });
    if (!transcriptRes.success) {
      showError(transcriptRes);
      return;
    }

    setLoadingPhase(ZWC_I18N.t(lang, "loadingVocab"));

    const level = Number(document.getElementById("level-select").value);
    const count = Number(document.getElementById("count-range").value);
    const sentences = document.getElementById("sentences-checkbox").checked;
    const discover = document.getElementById("discover-checkbox").checked;

    const vocabRes = await sendMessage("generateVocabulary", {
      videoId: currentVideo.videoId,
      transcriptText: transcriptRes.transcriptText,
      videoTitle: currentVideo.title,
      videoDescription: currentVideo.description,
      level,
      script: scriptChoice,
      count,
      sentences,
      discover,
    });

    if (!vocabRes.success) {
      showError(vocabRes);
      return;
    }

    currentCards = vocabRes.cards;
    renderResults(vocabRes);

    currentSettings = {
      ...currentSettings,
      defaultLevel: level,
      defaultScript: scriptChoice,
      defaultCount: count,
      defaultSentences: sentences,
      defaultDiscover: discover,
    };
    await sendMessage("saveSettings", { settings: currentSettings });
  } catch (err) {
    showError({ message: err.message });
  }
}

function onExport() {
  if (!currentCards || currentCards.length === 0) return;
  const tsv = ZWC_VOCAB.buildTsv(currentCards);
  const blob = new Blob([tsv], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const level = document.getElementById("level-select").value;
  const filename = ZWC_I18N.t(currentLang(), "tsvFilename", {
    videoId: currentVideo.videoId,
    level,
    count: currentCards.length,
  });
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

function wireStaticControls() {
  document.getElementById("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document
    .getElementById("missing-keys-open-options")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("error-options-link").addEventListener("click", () => chrome.runtime.openOptionsPage());

  document.querySelectorAll(".segmented-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      scriptChoice = btn.dataset.value;
      updateScriptToggle();
    });
  });

  const countRange = document.getElementById("count-range");
  countRange.addEventListener("input", () => {
    document.getElementById("count-value").textContent = countRange.value;
  });

  document.getElementById("generate-button").addEventListener("click", onGenerate);
  document.getElementById("export-button").addEventListener("click", onExport);
  document.getElementById("regenerate-button").addEventListener("click", () => showView("setup"));
  document.getElementById("error-back-button").addEventListener("click", () => showView("setup"));

  // Live re-translation: options.html writes settings directly to
  // chrome.storage.local, so a change while this panel is already open
  // (e.g. the user flips the language on the options page) is picked up here.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[ZWC_SETTINGS.STORAGE_KEY]) return;
    const newSettings = ZWC_SETTINGS.normalize(changes[ZWC_SETTINGS.STORAGE_KEY].newValue);
    if (currentSettings && newSettings.uiLanguage !== currentSettings.uiLanguage) {
      currentSettings = newSettings;
      ZWC_I18N.applyI18n(document, currentLang());
    }
  });
}

async function detectVideoAndShowSetup() {
  const meta = await sendMessage("getVideoMeta", {});
  if (!meta.success) {
    showView("welcome");
    return;
  }
  currentVideo = meta;
  document.getElementById("setup-video-title").textContent = meta.title || "";
  showView("setup");
}

async function init() {
  wireStaticControls();

  const settingsRes = await sendMessage("getSettings", {});
  currentSettings = settingsRes.settings;
  applyDefaultsToControls();
  ZWC_I18N.applyI18n(document, currentLang());

  if (!ZWC_SETTINGS.hasRequiredKeys(currentSettings)) {
    showView("missing-keys");
    return;
  }

  await detectVideoAndShowSetup();
}

init();
