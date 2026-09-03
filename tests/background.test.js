// background.js is a plain classic (non-module) service-worker script that
// uses importScripts() and top-level chrome.* calls. To unit test its pure
// helper functions, load its source into a Node vm sandbox with a faked
// chrome/importScripts, same technique used by the reference project this
// extension's structure is based on.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackgroundTesting() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    TextDecoder,
    AbortController,
    fetch: async () => {
      throw new Error("fetch not implemented in test sandbox");
    },
    chrome: {
      runtime: {
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        getURL: (p) => p,
      },
      storage: {
        local: {
          setAccessLevel: async () => {},
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
      },
      sidePanel: {
        setPanelBehavior: async () => {},
        open: async () => {},
      },
      tabs: {
        query: async () => [],
        get: async () => ({}),
      },
      scripting: {
        executeScript: async () => [],
      },
    },
    importScripts: () => {}, // settings.js/vocab-lib.js are pre-loaded into the sandbox below instead
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  vm.runInContext(read("settings.js"), sandbox);
  vm.runInContext(read("vocab-lib.js"), sandbox);
  vm.runInContext(read("background.js"), sandbox);

  return sandbox.__ZWC_BACKGROUND_TESTING__;
}

const T = loadBackgroundTesting();

test("extractPromptSection: extracts the fenced block under a heading", () => {
  const fileText = [
    "# Title",
    "",
    "## System prompt",
    "",
    "```",
    "Hello {name}",
    "```",
    "",
    "## User prompt",
    "",
    "```",
    "Body text",
    "```",
  ].join("\n");
  assert.equal(T.extractPromptSection(fileText, "System prompt"), "Hello {name}");
  assert.equal(T.extractPromptSection(fileText, "User prompt"), "Body text");
});

test("extractPromptSection: returns null for a missing heading", () => {
  assert.equal(T.extractPromptSection("## Only section\n```\nx\n```", "Nonexistent"), null);
});

test("substituteVariables: replaces every occurrence of each placeholder", () => {
  const result = T.substituteVariables("{a} and {a} and {b}", { a: "X", b: "Y" });
  assert.equal(result, "X and X and Y");
});

test("canonicalYouTubeUrl: builds a valid watch URL for a valid id", () => {
  assert.equal(T.canonicalYouTubeUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("canonicalYouTubeUrl: throws on an invalid/injection-shaped id", () => {
  assert.throws(() => T.canonicalYouTubeUrl("javascript:alert(1)"));
  assert.throws(() => T.canonicalYouTubeUrl(""));
});

test("levelLabel: level 7 is labeled as the merged 7-9 band", () => {
  assert.equal(T.levelLabel(7), "HSK 7–9");
  assert.equal(T.levelLabel(3), "HSK 3");
});

test("targetLanguageLabel: maps uiLanguage to the German prompt-facing label", () => {
  assert.equal(T.targetLanguageLabel("en"), "Englisch");
  assert.equal(T.targetLanguageLabel("de"), "Deutsch");
  assert.equal(T.targetLanguageLabel("bogus"), "Deutsch");
});

test("resolveHanzi: picks simplified or traditional by script", () => {
  const card = { simplified: "气候", traditional: "氣候" };
  assert.equal(T.resolveHanzi(card, "simplified"), "气候");
  assert.equal(T.resolveHanzi(card, "traditional"), "氣候");
});

test("extractContextSentence: returns the sentence containing the word", () => {
  const transcript = "今天天气很好。我们去公园散步了气候宜人。晚上下雨了。";
  const sentence = T.extractContextSentence(transcript, "气候");
  assert.match(sentence, /气候/);
  assert.doesNotMatch(sentence, /晚上下雨/);
});

test("extractContextSentence: falls back to a window around the word if no sentence boundary found", () => {
  const transcript = "abc气候def";
  const sentence = T.extractContextSentence(transcript, "气候");
  assert.match(sentence, /气候/);
});

test("extractContextSentence: empty string for a word not present", () => {
  assert.equal(T.extractContextSentence("完全不相关", "气候"), "");
});

test("supadataErrorForStatus: maps known status codes to typed error codes", () => {
  assert.equal(T.supadataErrorForStatus(206).code, "NO_TRANSCRIPT");
  assert.equal(T.supadataErrorForStatus(401).code, "INVALID_SUPADATA_KEY");
  assert.equal(T.supadataErrorForStatus(403).code, "INVALID_SUPADATA_KEY");
  assert.equal(T.supadataErrorForStatus(404).code, "VIDEO_NOT_FOUND");
  assert.equal(T.supadataErrorForStatus(429).code, "RATE_LIMITED");
  assert.equal(T.supadataErrorForStatus(500).code, "SUPADATA_ERROR");
});
