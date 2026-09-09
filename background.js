// Service worker: message dispatch, transcript fetch (Supadata), vocabulary
// generation (Case A/B), and Anthropic (Claude) LLM calls.

importScripts("settings.js", "vocab-lib.js");

// ==================== SETUP ====================

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// ==================== SETTINGS ====================

async function getSettingsRaw() {
  const all = await chrome.storage.local.get(ZWC_SETTINGS.STORAGE_KEY);
  return all[ZWC_SETTINGS.STORAGE_KEY];
}

async function handleGetSettings() {
  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  return { success: true, settings };
}

async function handleSaveSettings(payload) {
  const normalized = ZWC_SETTINGS.normalize(payload && payload.settings);
  await chrome.storage.local.set({ [ZWC_SETTINGS.STORAGE_KEY]: normalized });
  return { success: true, settings: normalized };
}

// ==================== CACHE HELPERS ====================

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TRANSCRIPT_CACHE_MAX_ENTRIES = 20;
const VOCAB_CACHE_MAX_ENTRIES = 30;

async function getCached(key) {
  const all = await chrome.storage.local.get(key);
  const entry = all[key];
  if (!entry) return null;
  if (Date.now() - (entry.createdAt || 0) > CACHE_MAX_AGE_MS) return null;
  return entry;
}

async function setCached(key, value) {
  await chrome.storage.local.set({ [key]: { ...value, createdAt: Date.now() } });
}

async function evictOldEntries(prefix, maxEntries) {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
  const now = Date.now();
  const expired = keys.filter((k) => now - (all[k].createdAt || 0) > CACHE_MAX_AGE_MS);
  const alive = keys
    .filter((k) => !expired.includes(k))
    .sort((a, b) => (all[a].createdAt || 0) - (all[b].createdAt || 0));
  const toRemove = [...expired];
  if (alive.length > maxEntries) {
    toRemove.push(...alive.slice(0, alive.length - maxEntries));
  }
  if (toRemove.length) {
    await chrome.storage.local.remove(toRemove);
  }
}

// ==================== VIDEO META ====================

function mainWorldExtractVideoDetails() {
  try {
    const player = document.getElementById("movie_player");
    const response =
      player && typeof player.getPlayerResponse === "function" ? player.getPlayerResponse() : null;
    const details = response && response.videoDetails;
    if (details) {
      return {
        videoId: details.videoId,
        title: details.title,
        channel: details.author,
        description: details.shortDescription,
      };
    }
  } catch (e) {
    // fall through to caller's fallback
  }
  return null;
}

async function handleGetVideoMeta(payload) {
  let tabId = payload && payload.tabId;
  if (typeof tabId !== "number") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab && tab.id;
  }
  if (typeof tabId !== "number") {
    return { success: false, error: "NO_TAB", message: "No active tab found." };
  }

  const tab = await chrome.tabs.get(tabId);
  const url = tab.url || "";
  const match = /[?&]v=([A-Za-z0-9_-]{6,20})/.exec(url);
  if (!match) {
    return { success: false, error: "NOT_A_VIDEO", message: "No YouTube video in this tab." };
  }
  const videoIdFromUrl = match[1];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: mainWorldExtractVideoDetails,
    });
    const result = results && results[0] && results[0].result;
    if (result) {
      return {
        success: true,
        videoId: result.videoId || videoIdFromUrl,
        title: result.title || tab.title || "",
        description: result.description || "",
      };
    }
  } catch (e) {
    // fall through to basic fallback below
  }

  return {
    success: true,
    videoId: videoIdFromUrl,
    title: (tab.title || "").replace(/\s*-\s*YouTube\s*$/, ""),
    description: "",
  };
}

// ==================== TRANSCRIPT FETCHING VIA SUPADATA ====================

const SUPADATA_BASE_URL = "https://api.supadata.ai";

function canonicalYouTubeUrl(videoId) {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId || "")) {
    const err = new Error("Invalid video id");
    err.code = "INVALID_VIDEO_ID";
    throw err;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function supadataErrorForStatus(status) {
  if (status === 206) return { code: "NO_TRANSCRIPT", message: "No transcript available for this video." };
  if (status === 401 || status === 403) return { code: "INVALID_SUPADATA_KEY", message: "Invalid Supadata API key." };
  if (status === 404) return { code: "VIDEO_NOT_FOUND", message: "Video not found or private." };
  if (status === 429) return { code: "RATE_LIMITED", message: "Supadata rate limit reached." };
  return { code: "SUPADATA_ERROR", message: `Supadata-Anfrage fehlgeschlagen: HTTP ${status}` };
}

async function pollTranscriptJob(jobId, apiKey) {
  const url = `${SUPADATA_BASE_URL}/v1/transcript/${jobId}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (res.status === 202) continue;
    if (!res.ok) {
      const { code, message } = supadataErrorForStatus(res.status);
      const err = new Error(message);
      err.code = code;
      throw err;
    }
    const data = await res.json();
    return { transcriptText: data.content, lang: data.lang };
  }
  const err = new Error("Supadata-Job Timeout.");
  err.code = "SUPADATA_TIMEOUT";
  throw err;
}

async function fetchTranscriptFromSupadata(videoId, apiKey) {
  const url = new URL(`${SUPADATA_BASE_URL}/v1/transcript`);
  url.searchParams.set("url", canonicalYouTubeUrl(videoId));
  url.searchParams.set("mode", "native");
  url.searchParams.set("text", "true");

  const res = await fetch(url.toString(), { headers: { "x-api-key": apiKey } });

  if (res.status === 202) {
    const { jobId } = await res.json();
    return pollTranscriptJob(jobId, apiKey);
  }
  if (!res.ok) {
    const { code, message } = supadataErrorForStatus(res.status);
    const err = new Error(message);
    err.code = code;
    throw err;
  }

  const data = await res.json();
  return { transcriptText: data.content, lang: data.lang };
}

async function handleFetchTranscript(payload) {
  const { videoId } = payload || {};
  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  if (!settings.supadataApiKey) {
    return { success: false, error: "MISSING_SUPADATA_KEY", message: "No Supadata API key configured." };
  }

  const cacheKey = `transcript_${videoId}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return { success: true, transcriptText: cached.transcriptText, lang: cached.lang, fromCache: true };
  }

  try {
    const result = await fetchTranscriptFromSupadata(videoId, settings.supadataApiKey);
    await setCached(cacheKey, result);
    await evictOldEntries("transcript_", TRANSCRIPT_CACHE_MAX_ENTRIES);
    return { success: true, transcriptText: result.transcriptText, lang: result.lang };
  } catch (err) {
    return { success: false, error: err.code || "UNKNOWN", message: err.message };
  }
}

// ==================== PROMPT LOADING ====================

const promptFileCache = new Map();

async function loadPromptFile(fileName) {
  if (promptFileCache.has(fileName)) return promptFileCache.get(fileName);
  const url = chrome.runtime.getURL(`prompts/${fileName}`);
  const res = await fetch(url);
  const text = await res.text();
  promptFileCache.set(fileName, text);
  return text;
}

function extractPromptSection(fileText, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^##\\s+${escaped}\\s*$`, "m");
  const match = headingRe.exec(fileText);
  if (!match) return null;
  const rest = fileText.slice(match.index + match[0].length);
  const nextHeadingMatch = /^##\s+/m.exec(rest);
  const section = nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
  const codeBlockMatch = /```[a-zA-Z]*\n([\s\S]*?)```/.exec(section);
  return codeBlockMatch ? codeBlockMatch[1].trim() : null;
}

function substituteVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables || {})) {
    result = result.split(`{${key}}`).join(String(value));
  }
  return result;
}

async function loadPromptSection(fileName, heading, variables) {
  const fileText = await loadPromptFile(fileName);
  const section = extractPromptSection(fileText, heading);
  if (section == null) {
    throw new Error(`Prompt section "${heading}" not found in ${fileName}`);
  }
  return substituteVariables(section, variables);
}

// ==================== ANTHROPIC AI COMPLETION ====================

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";
const AI_IDLE_TIMEOUT_MS = 50000;
const AI_HARD_TIMEOUT_MS = 120000;
const AI_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function readBoundedAiResponse(response) {
  if (!response.body || !response.body.getReader) {
    return response.text();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  let idleTimer;
  let idleTimedOut = false;

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      reader.cancel().catch(() => {});
    }, AI_IDLE_TIMEOUT_MS);
  };

  resetIdle();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      received += value.byteLength;
      if (received > AI_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        const err = new Error("AI response exceeded size limit");
        err.code = "AI_RESPONSE_TOO_LARGE";
        throw err;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
  if (idleTimedOut) {
    const err = new Error("AI response idle timeout");
    err.code = "AI_IDLE_TIMEOUT";
    throw err;
  }
  text += decoder.decode();
  return text;
}

// system/userContent map onto Anthropic's Messages API shape (system is a
// top-level field, not a "system"-role message). `effort: "low"` keeps cost
// and latency down for this bounded, structured-JSON-output task — thinking
// is left at its adaptive default (disabling it on Opus explicitly can make
// the model leak tool-call-shaped text into the visible response instead).
async function requestAiCompletion({ apiKey, baseUrl, model, system, userContent }) {
  if (!apiKey) {
    const err = new Error("Missing Anthropic API key");
    err.code = "MISSING_AI_KEY";
    throw err;
  }

  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), AI_HARD_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        // Required for direct browser/extension-side calls (the SDK's
        // dangerouslyAllowBrowser flag sets this same header). This is the
        // user's own key, stored locally and called directly from the
        // extension — same bring-your-own-key trust model as Supadata.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: userContent }],
        output_config: { effort: "low" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(hardTimer);
    if (controller.signal.aborted) {
      const e = new Error("AI request hard timeout");
      e.code = "AI_HARD_TIMEOUT";
      throw e;
    }
    const e = new Error(err.message || "AI network error");
    e.code = "AI_NETWORK_ERROR";
    throw e;
  }

  if (!response.ok) {
    clearTimeout(hardTimer);
    let detail = "";
    try {
      const body = await response.json();
      detail = (body && body.error && body.error.message) || "";
    } catch (e) {
      // response body wasn't JSON (or already consumed) — fall back to the bare status
    }
    const err = new Error(detail ? `AI request failed: HTTP ${response.status} — ${detail}` : `AI request failed: HTTP ${response.status}`);
    err.code =
      response.status === 401 || response.status === 403
        ? "INVALID_AI_KEY"
        : response.status === 429
        ? "AI_RATE_LIMITED"
        : "AI_REQUEST_FAILED";
    throw err;
  }

  let rawText;
  try {
    rawText = await readBoundedAiResponse(response);
  } finally {
    clearTimeout(hardTimer);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    const e = new Error("AI response was not valid JSON");
    e.code = "AI_BAD_RESPONSE";
    throw e;
  }

  const textBlock = Array.isArray(parsed && parsed.content)
    ? parsed.content.find((block) => block && block.type === "text")
    : null;
  if (!textBlock || typeof textBlock.text !== "string") {
    const e = new Error("AI response missing content");
    e.code = "AI_BAD_RESPONSE";
    throw e;
  }
  return textBlock.text;
}

// ==================== VOCABULARY GENERATION (CASE A / CASE B) ====================

const levelDataCache = new Map();

async function loadHskLevelData(level) {
  if (levelDataCache.has(level)) return levelDataCache.get(level);
  const url = chrome.runtime.getURL(`data/hsk-${level}.json`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load HSK level ${level} data`);
  const data = await res.json();
  levelDataCache.set(level, data);
  return data;
}

// Everything the learner is assumed to know at `level`: all HSK levels up to
// and including it, both script forms. Discovery mode subtracts this set.
const knownWordSetCache = new Map();

async function loadKnownWordSet(level) {
  if (knownWordSetCache.has(level)) return knownWordSetCache.get(level);
  const set = new Set();
  for (let l = ZWC_SETTINGS.MIN_LEVEL; l <= level; l++) {
    for (const word of await loadHskLevelData(l)) {
      set.add(word.simplified);
      if (word.traditional) set.add(word.traditional);
    }
  }
  knownWordSetCache.set(level, set);
  return set;
}

function levelLabel(level) {
  return level === 7 ? "HSK 7–9" : `HSK ${level}`;
}

function targetLanguageLabel(uiLanguage) {
  return uiLanguage === "de" ? "Deutsch" : "Englisch";
}

function resolveHanzi(card, script) {
  return script === "traditional" ? card.traditional : card.simplified;
}

function extractContextSentence(transcript, word) {
  if (!word) return "";
  const sentences = transcript.split(/(?<=[。！？.!?])\s*/);
  for (const sentence of sentences) {
    if (sentence.includes(word)) {
      return sentence.trim().slice(0, 200);
    }
  }
  const index = transcript.indexOf(word);
  if (index === -1) return "";
  const start = Math.max(0, index - 30);
  const end = Math.min(transcript.length, index + word.length + 30);
  return transcript.slice(start, end).trim();
}

// Prompt fragments for the optional example-sentence mode. Empty strings when
// off, so the prompt files stay a single source of truth for both modes.
const SENTENCE_FRAGMENTS = {
  A: {
    sentenceFields: ', "sentencePinyin": "<Pinyin des Kontextsatzes>", "sentenceTranslation": "<Übersetzung des Kontextsatzes>"',
    sentenceRule: `
Zusätzlich lieferst du zu jedem Wort zwei Angaben zum mitgelieferten contextSentence:
"sentencePinyin" = das vollständige Pinyin dieses Satzes mit Tonzeichen (z. B. "Wǒ xǐhuān hē chá."),
"sentenceTranslation" = die Übersetzung dieses Satzes auf {targetLanguage}.
Gib den Satz selbst NICHT zurück und ändere ihn nicht — er ist bereits bekannt.`,
    sentenceReminder: " Vergiss sentencePinyin und sentenceTranslation nicht.",
  },
  B: {
    sentenceFields: ', "sentence": "<Beispielsatz>", "sentencePinyin": "<Pinyin des Satzes>", "sentenceTranslation": "<Übersetzung des Satzes>"',
    sentenceRule: `
Zusätzlich erfindest du zu jedem gewählten Wort einen kurzen, natürlichen Beispielsatz:
"sentence" = ein Satz auf Chinesisch (max. 20 Zeichen), der das Wort enthält, zum Thema des
Videos passt und den Wortschatz des Ziel-Levels nicht überschreitet,
"sentencePinyin" = das vollständige Pinyin dieses Satzes mit Tonzeichen,
"sentenceTranslation" = die Übersetzung dieses Satzes auf {targetLanguage}.`,
    sentenceReminder: " Vergiss sentence, sentencePinyin und sentenceTranslation nicht.",
  },
};

const NO_SENTENCE_FRAGMENTS = { sentenceFields: "", sentenceRule: "", sentenceReminder: "" };

function sentenceFragments(caseKey, withSentences, targetLanguage) {
  if (!withSentences) return NO_SENTENCE_FRAGMENTS;
  const f = SENTENCE_FRAGMENTS[caseKey];
  return { ...f, sentenceRule: substituteVariables(f.sentenceRule, { targetLanguage }) };
}

const CASE_B_CANDIDATE_LIMIT = 400;
const CASE_B_TRANSCRIPT_EXCERPT_CHARS = 3500;
// Discovery reads the transcript itself instead of matching against a list, so
// it gets a bigger window — words it never sees are words it cannot suggest.
const DISCOVER_TRANSCRIPT_EXCERPT_CHARS = 8000;

function buildVideoSummary(videoTitle, videoDescription, transcriptText, excerptChars) {
  return `Titel: ${videoTitle || ""}\nBeschreibung: ${(videoDescription || "").slice(
    0,
    500
  )}\nTranskript-Auszug: ${(transcriptText || "").slice(0, excerptChars)}`;
}

function scriptLabel(script) {
  return script === "traditional" ? "traditionellen Zeichen" : "vereinfachten Zeichen";
}

async function runCaseA(
  transcriptText,
  videoTitle,
  levelWords,
  safeScript,
  safeCount,
  targetLanguage,
  withSentences
) {
  const matches = ZWC_VOCAB.matchCandidatesInTranscript(transcriptText, levelWords, safeCount);
  if (matches.length === 0) return { cards: [] };

  const wordList = [];
  const sourceById = new Map();
  matches.forEach((c, i) => {
    const id = String(i);
    const contextSentence =
      extractContextSentence(transcriptText, c.simplified) || extractContextSentence(transcriptText, c.traditional);
    wordList.push({ id, word: resolveHanzi(c, safeScript), contextSentence });
    // The sentence only becomes part of the card when the user asked for it —
    // validateAndRebuildVocabResponse picks it up from here, so the card's
    // sentence is always the transcript's, never the model's echo of it.
    sourceById.set(id, withSentences ? { ...c, contextSentence } : c);
  });

  const fragments = sentenceFragments("A", withSentences, targetLanguage);
  const [systemPrompt, userPrompt] = await Promise.all([
    loadPromptSection("vocab-translate-batch.md", "System prompt", { targetLanguage, ...fragments }),
    loadPromptSection("vocab-translate-batch.md", "User prompt", {
      videoTitle: videoTitle || "",
      wordList: JSON.stringify(wordList),
      targetLanguage,
      ...fragments,
    }),
  ]);

  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  const content = await requestAiCompletion({
    apiKey: settings.anthropicApiKey,
    baseUrl: ANTHROPIC_BASE_URL,
    model: ANTHROPIC_MODEL,
    system: systemPrompt,
    userContent: userPrompt,
  });

  const parsed = ZWC_VOCAB.parseLooseJson(content);
  return ZWC_VOCAB.validateAndRebuildVocabResponse(parsed, sourceById);
}

async function runCaseB(
  transcriptText,
  videoTitle,
  videoDescription,
  levelWords,
  safeScript,
  safeLevel,
  safeCount,
  targetLanguage,
  withSentences
) {
  const truncated = [...levelWords]
    .sort((a, b) => (a.freq ?? Infinity) - (b.freq ?? Infinity))
    .slice(0, CASE_B_CANDIDATE_LIMIT);
  const sourceById = new Map(truncated.map((c, i) => [String(i), c]));
  const candidateWords = truncated.map((c, i) => ({
    id: String(i),
    word: resolveHanzi(c, safeScript),
    pinyin: c.pinyin,
  }));

  const videoSummary = buildVideoSummary(
    videoTitle,
    videoDescription,
    transcriptText,
    CASE_B_TRANSCRIPT_EXCERPT_CHARS
  );

  const fragments = sentenceFragments("B", withSentences, targetLanguage);
  const [systemPrompt, userPrompt] = await Promise.all([
    loadPromptSection("vocab-topic-select.md", "System prompt", { targetLanguage, ...fragments }),
    loadPromptSection("vocab-topic-select.md", "User prompt", {
      videoSummary,
      level: levelLabel(safeLevel),
      count: String(safeCount),
      candidateWords: JSON.stringify(candidateWords),
      targetLanguage,
      ...fragments,
    }),
  ]);

  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  const content = await requestAiCompletion({
    apiKey: settings.anthropicApiKey,
    baseUrl: ANTHROPIC_BASE_URL,
    model: ANTHROPIC_MODEL,
    system: systemPrompt,
    userContent: userPrompt,
  });

  const parsed = ZWC_VOCAB.parseLooseJson(content);
  return ZWC_VOCAB.validateAndRebuildVocabResponse(parsed, sourceById);
}

// Discovery mode: topic vocabulary from outside the HSK lists, at the chosen
// level's difficulty. Handles both video kinds — they differ only in what the
// model gets as context and whether its answers can be checked against the
// transcript. Sentence fragments are the Case B ones in both: the words are
// unknown before the call, so no context sentence can be supplied up front.
async function runDiscover(
  transcriptText,
  videoTitle,
  videoDescription,
  isChinese,
  knownWords,
  safeScript,
  safeLevel,
  safeCount,
  targetLanguage,
  withSentences
) {
  const context = isChinese
    ? `Transkript-Auszug:\n${(transcriptText || "").slice(0, DISCOVER_TRANSCRIPT_EXCERPT_CHARS)}`
    : buildVideoSummary(videoTitle, videoDescription, transcriptText, CASE_B_TRANSCRIPT_EXCERPT_CHARS);

  const sourceRule = isChinese
    ? `Du bekommst einen Auszug aus dem chinesischen Transkript eines Videos. Wähle daraus Wörter aus,
die inhaltlich das Thema des Videos tragen. Jedes zurückgegebene Wort MUSS wörtlich und exakt in
diesem Auszug vorkommen — Wörter, die dort nicht stehen, werden verworfen.`
    : `Du bekommst die Zusammenfassung eines Videos, das NICHT auf Chinesisch ist. Schlage chinesische
Wörter vor, die inhaltlich zum Thema des Videos gehören und die man braucht, um auf Chinesisch
über dieses Thema zu sprechen.`;

  const fragments = sentenceFragments("B", withSentences, targetLanguage);
  const variables = {
    sourceRule,
    context,
    level: levelLabel(safeLevel),
    scriptLabel: scriptLabel(safeScript),
    count: String(safeCount),
    targetLanguage,
    ...fragments,
  };
  const [systemPrompt, userPrompt] = await Promise.all([
    loadPromptSection("vocab-discover.md", "System prompt", variables),
    loadPromptSection("vocab-discover.md", "User prompt", variables),
  ]);

  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  const content = await requestAiCompletion({
    apiKey: settings.anthropicApiKey,
    baseUrl: ANTHROPIC_BASE_URL,
    model: ANTHROPIC_MODEL,
    system: systemPrompt,
    userContent: userPrompt,
  });

  const parsed = ZWC_VOCAB.parseLooseJson(content);
  return ZWC_VOCAB.validateDiscoveredVocabResponse(parsed, {
    // Only a Chinese transcript can prove a word was really in the video.
    transcript: isChinese ? transcriptText : null,
    knownWords,
  });
}

async function handleGenerateVocabulary(payload) {
  const { videoId, transcriptText, videoTitle, videoDescription, level, script, count, sentences, discover } =
    payload || {};
  const settings = ZWC_SETTINGS.normalize(await getSettingsRaw());
  if (!settings.anthropicApiKey) {
    return { success: false, error: "MISSING_AI_KEY", message: "No Anthropic API key configured." };
  }
  if (!transcriptText) {
    return { success: false, error: "NO_TRANSCRIPT", message: "No transcript available." };
  }

  const safeLevel = Math.min(ZWC_SETTINGS.MAX_LEVEL, Math.max(ZWC_SETTINGS.MIN_LEVEL, Number(level) || settings.defaultLevel));
  const safeCount = Math.min(ZWC_SETTINGS.MAX_COUNT, Math.max(ZWC_SETTINGS.MIN_COUNT, Number(count) || settings.defaultCount));
  const safeScript = script === "traditional" ? "traditional" : "simplified";
  const withSentences = sentences === true;
  const withDiscover = discover === true;

  const targetLanguage = targetLanguageLabel(settings.uiLanguage);
  const cacheKey = `vocab_${videoId}_HSK${safeLevel}_${safeScript}_${safeCount}_${settings.uiLanguage}_s${
    withSentences ? 1 : 0
  }_d${withDiscover ? 1 : 0}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return { success: true, cards: cached.cards, caseUsed: cached.caseUsed, fromCache: true };
  }

  const isChinese = ZWC_VOCAB.detectIsChineseText(transcriptText);

  let rebuilt;
  let caseUsed;
  try {
    if (withDiscover) {
      caseUsed = "D";
      rebuilt = await runDiscover(
        transcriptText,
        videoTitle,
        videoDescription,
        isChinese,
        await loadKnownWordSet(safeLevel),
        safeScript,
        safeLevel,
        safeCount,
        targetLanguage,
        withSentences
      );
    } else if (isChinese) {
      const levelWords = await loadHskLevelData(safeLevel);
      caseUsed = "A";
      rebuilt = await runCaseA(
        transcriptText,
        videoTitle,
        levelWords,
        safeScript,
        safeCount,
        targetLanguage,
        withSentences
      );
    } else {
      caseUsed = "B";
      rebuilt = await runCaseB(
        transcriptText,
        videoTitle,
        videoDescription,
        await loadHskLevelData(safeLevel),
        safeScript,
        safeLevel,
        safeCount,
        targetLanguage,
        withSentences
      );
    }
  } catch (err) {
    return { success: false, error: err.code || "UNKNOWN", message: err.message };
  }

  if (!rebuilt.cards || rebuilt.cards.length === 0) {
    const EMPTY = {
      A: ["NO_MATCHES", "Keine passenden Vokabeln auf diesem Level im Transkript gefunden."],
      B: ["NO_CARDS", "Es konnten keine gültigen Vokabelkarten erzeugt werden."],
      D: ["NO_DISCOVERIES", "Keine neuen Vokabeln außerhalb der HSK-Liste gefunden."],
    };
    const [error, message] = EMPTY[caseUsed];
    return { success: false, error, message };
  }

  const finalCards = rebuilt.cards.map((c) => ({
    hanzi: resolveHanzi(c, safeScript),
    pinyin: c.pinyin,
    translation: c.translation,
    // Discovered words are outside the HSK lists and have no level.
    level: c.level ? c.level.value : null,
    sentence: c.sentence,
    sentencePinyin: c.sentencePinyin,
    sentenceTranslation: c.sentenceTranslation,
  }));

  await setCached(cacheKey, { cards: finalCards, caseUsed });
  await evictOldEntries("vocab_", VOCAB_CACHE_MAX_ENTRIES);

  return { success: true, cards: finalCards, caseUsed };
}

// ==================== SIDE PANEL ====================

async function handleOpenSidePanel(payload, sender) {
  const tabId = (payload && payload.tabId) || (sender && sender.tab && sender.tab.id);
  if (typeof tabId !== "number") {
    return { success: false, error: "NO_TAB", message: "No tab found." };
  }
  await chrome.sidePanel.open({ tabId });
  return { success: true };
}

// ==================== MESSAGE HANDLING ====================

const HANDLERS = {
  getSettings: handleGetSettings,
  saveSettings: handleSaveSettings,
  getVideoMeta: handleGetVideoMeta,
  fetchTranscript: handleFetchTranscript,
  generateVocabulary: handleGenerateVocabulary,
  openSidePanel: handleOpenSidePanel,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = message && HANDLERS[message.action];
  if (!handler) return false;
  handler(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err.code || "UNKNOWN", message: err.message || String(err) }));
  return true;
});

// ==================== TESTING EXPORTS ====================

if (typeof globalThis !== "undefined") {
  globalThis.__ZWC_BACKGROUND_TESTING__ = {
    extractPromptSection,
    substituteVariables,
    canonicalYouTubeUrl,
    levelLabel,
    targetLanguageLabel,
    resolveHanzi,
    extractContextSentence,
    sentenceFragments,
    supadataErrorForStatus,
  };
}
