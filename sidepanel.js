// Side panel state machine: welcome -> missing-keys / setup -> loading ->
// results / error. Flat top-level state, no framework.

const VIEWS = ["welcome", "missing-keys", "setup", "loading", "results", "error"];

let currentSettings = null;
let currentVideo = null; // {videoId, title, description}
let currentCards = null; // last generated cards, for TSV export
let scriptChoice = "simplified";

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
    const timeoutId = setTimeout(() => reject(new Error("Zeitüberschreitung bei der Anfrage.")), 130000);
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
  scriptChoice = currentSettings.defaultScript;
  updateScriptToggle();
}

const ERROR_MESSAGES = {
  MISSING_SUPADATA_KEY: "Kein Supadata API-Key hinterlegt.",
  MISSING_AI_KEY: "Kein Anthropic API-Key hinterlegt.",
  INVALID_SUPADATA_KEY: "Der Supadata API-Key ist ungültig.",
  INVALID_AI_KEY: "Der Anthropic API-Key ist ungültig.",
  NO_TRANSCRIPT: "Für dieses Video ist kein Transkript verfügbar.",
  VIDEO_NOT_FOUND: "Video nicht gefunden oder privat.",
  RATE_LIMITED: "Supadata Rate-Limit erreicht — versuche es später erneut.",
  AI_RATE_LIMITED: "Anthropic Rate-Limit erreicht — versuche es später erneut.",
  NOT_A_VIDEO: "Kein YouTube-Video in diesem Tab geöffnet.",
  NO_MATCHES: "Keine passenden Vokabeln auf diesem Level im Transkript gefunden.",
  NO_CARDS: "Es konnten keine gültigen Vokabelkarten erzeugt werden.",
};

const KEY_ERROR_CODES = new Set([
  "MISSING_SUPADATA_KEY",
  "MISSING_AI_KEY",
  "INVALID_SUPADATA_KEY",
  "INVALID_AI_KEY",
]);

function showError(response) {
  const code = response && response.error;
  const message = (code && ERROR_MESSAGES[code]) || (response && response.message) || "Unbekannter Fehler.";
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-options-link").hidden = !KEY_ERROR_CODES.has(code);
  showView("error");
}

function renderResults(vocabRes) {
  const tbody = document.getElementById("results-tbody");
  tbody.innerHTML = "";
  for (const card of vocabRes.cards) {
    const tr = document.createElement("tr");
    const hanziTd = document.createElement("td");
    hanziTd.textContent = card.hanzi;
    const pinyinTd = document.createElement("td");
    pinyinTd.textContent = card.pinyin;
    const germanTd = document.createElement("td");
    germanTd.textContent = card.german;
    tr.append(hanziTd, pinyinTd, germanTd);
    tbody.appendChild(tr);
  }
  const caseLabel = vocabRes.caseUsed === "A" ? "aus dem Transkript" : "thematisch generiert";
  document.getElementById("results-summary").textContent = `${vocabRes.cards.length} Vokabeln (${caseLabel})`;
  showView("results");
}

async function onGenerate() {
  showView("loading");
  setLoadingPhase("Transkript wird geladen…");

  try {
    const transcriptRes = await sendMessage("fetchTranscript", { videoId: currentVideo.videoId });
    if (!transcriptRes.success) {
      showError(transcriptRes);
      return;
    }

    setLoadingPhase("Vokabeln werden ausgewählt und übersetzt…");

    const level = Number(document.getElementById("level-select").value);
    const count = Number(document.getElementById("count-range").value);

    const vocabRes = await sendMessage("generateVocabulary", {
      videoId: currentVideo.videoId,
      transcriptText: transcriptRes.transcriptText,
      videoTitle: currentVideo.title,
      videoDescription: currentVideo.description,
      level,
      script: scriptChoice,
      count,
    });

    if (!vocabRes.success) {
      showError(vocabRes);
      return;
    }

    currentCards = vocabRes.cards;
    renderResults(vocabRes);

    currentSettings = { ...currentSettings, defaultLevel: level, defaultScript: scriptChoice, defaultCount: count };
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
  const filename = `chinesisch-vokabeln-${currentVideo.videoId}-HSK${level}-${currentCards.length}.tsv`;
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

  if (!ZWC_SETTINGS.hasRequiredKeys(currentSettings)) {
    showView("missing-keys");
    return;
  }

  await detectVideoAndShowSetup();
}

init();
