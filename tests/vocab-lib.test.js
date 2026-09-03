const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectIsChineseText,
  matchCandidatesInTranscript,
  parseLooseJson,
  validateAndRebuildVocabResponse,
  buildTsv,
} = require("../vocab-lib.js");

test("detectIsChineseText: pure Chinese text is detected", () => {
  assert.equal(detectIsChineseText("这是一个关于气候变化的视频，我们来聊聊环境问题。"), true);
});

test("detectIsChineseText: pure English text is not detected", () => {
  assert.equal(
    detectIsChineseText("This is a video about climate change, let's talk about the environment."),
    false
  );
});

test("detectIsChineseText: a few Chinese loanwords in an English transcript stay below threshold", () => {
  assert.equal(
    detectIsChineseText("We visited a 功夫 studio while filming this travel vlog about Beijing food culture."),
    false
  );
});

test("detectIsChineseText: empty/short input is false", () => {
  assert.equal(detectIsChineseText(""), false);
  assert.equal(detectIsChineseText("   "), false);
});

const CANDIDATES = [
  { simplified: "气候", traditional: "氣候", pinyin: "qìhòu", zhuyin: "ㄑㄧˋ ㄏㄡˋ", level: { system: "HSK", value: 3 }, freq: 100 },
  { simplified: "环境", traditional: "環境", pinyin: "huánjìng", zhuyin: "ㄏㄨㄢˊ ㄐㄧㄥˋ", level: { system: "HSK", value: 3 }, freq: 50 },
  { simplified: "你好", traditional: "你好", pinyin: "nǐ hǎo", zhuyin: "ㄋㄧˇ ㄏㄠˇ", level: { system: "HSK", value: 1 }, freq: 1 },
];

test("matchCandidatesInTranscript: counts occurrences and ranks by frequency-in-transcript", () => {
  const transcript = "气候变化很重要。气候问题需要关注。环境也很重要。";
  const result = matchCandidatesInTranscript(transcript, CANDIDATES, 10);
  assert.equal(result.length, 2);
  assert.equal(result[0].simplified, "气候");
  assert.equal(result[0].occurrences, 2);
  assert.equal(result[1].simplified, "环境");
  assert.equal(result[1].occurrences, 1);
});

test("matchCandidatesInTranscript: matches either script form", () => {
  const transcript = "氣候變化是個大問題。";
  const result = matchCandidatesInTranscript(transcript, CANDIDATES, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].simplified, "气候");
});

test("matchCandidatesInTranscript: respects the count cap", () => {
  const transcript = "气候 环境 你好";
  const result = matchCandidatesInTranscript(transcript, CANDIDATES, 2);
  assert.equal(result.length, 2);
});

test("matchCandidatesInTranscript: no matches returns empty array", () => {
  assert.deepEqual(matchCandidatesInTranscript("完全不相关的内容", CANDIDATES, 10), []);
});

test("parseLooseJson: parses a plain JSON array", () => {
  assert.deepEqual(parseLooseJson('[{"id":"0","german":"Klima"}]'), [{ id: "0", german: "Klima" }]);
});

test("parseLooseJson: strips ```json fences", () => {
  const raw = '```json\n[{"id":"0","german":"Klima"}]\n```';
  assert.deepEqual(parseLooseJson(raw), [{ id: "0", german: "Klima" }]);
});

test("parseLooseJson: tolerates trailing commas", () => {
  const raw = '[{"id":"0","german":"Klima"},]';
  assert.deepEqual(parseLooseJson(raw), [{ id: "0", german: "Klima" }]);
});

test("parseLooseJson: returns null for unparseable garbage", () => {
  assert.equal(parseLooseJson("not json at all"), null);
});

test("validateAndRebuildVocabResponse: rebuilds facts from source, trusts only german", () => {
  const sourceById = new Map([
    ["0", { simplified: "气候", traditional: "氣候", pinyin: "qìhòu", zhuyin: "z", level: { system: "HSK", value: 3 } }],
  ]);
  const llmItems = [{ id: "0", simplified: "HALLUCINATED", pinyin: "wrong", german: "Klima" }];
  const { cards, droppedIds } = validateAndRebuildVocabResponse(llmItems, sourceById);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].simplified, "气候"); // from source, not the LLM's own echo
  assert.equal(cards[0].pinyin, "qìhòu");
  assert.equal(cards[0].german, "Klima");
  assert.deepEqual(droppedIds, []);
});

test("validateAndRebuildVocabResponse: drops hallucinated ids not in the candidate list", () => {
  const sourceById = new Map([["0", { simplified: "气候", traditional: "氣候", pinyin: "qìhòu", level: { system: "HSK", value: 3 } }]]);
  const llmItems = [
    { id: "0", german: "Klima" },
    { id: "99", german: "Erfundenes Wort" },
  ];
  const { cards, droppedIds } = validateAndRebuildVocabResponse(llmItems, sourceById);
  assert.equal(cards.length, 1);
  assert.deepEqual(droppedIds, ["99"]);
});

test("validateAndRebuildVocabResponse: drops entries with missing/empty german", () => {
  const sourceById = new Map([["0", { simplified: "气候", traditional: "氣候", pinyin: "qìhòu", level: { system: "HSK", value: 3 } }]]);
  const { cards } = validateAndRebuildVocabResponse([{ id: "0", german: "" }], sourceById);
  assert.equal(cards.length, 0);
});

test("validateAndRebuildVocabResponse: a malformed row doesn't throw, whole batch keeps going", () => {
  const sourceById = new Map([["0", { simplified: "气候", traditional: "氣候", pinyin: "qìhòu", level: { system: "HSK", value: 3 } }]]);
  const { cards } = validateAndRebuildVocabResponse([null, "not-an-object", { id: "0", german: "Klima" }], sourceById);
  assert.equal(cards.length, 1);
});

test("validateAndRebuildVocabResponse: non-array input returns empty result", () => {
  const { cards, droppedIds } = validateAndRebuildVocabResponse({ not: "an array" }, new Map());
  assert.deepEqual(cards, []);
  assert.deepEqual(droppedIds, []);
});

test("buildTsv: no header row — only data rows, so Anki's import never gets a literal 'Hanzi/Pinyin/Deutsch' card", () => {
  const tsv = buildTsv([{ hanzi: "气候", pinyin: "qìhòu", german: "Klima" }]);
  const lines = tsv.trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(lines[0], "气候\tqìhòu\tKlima");
});

test("buildTsv: sanitizes literal tabs/newlines inside fields", () => {
  const tsv = buildTsv([{ hanzi: "气候", pinyin: "qìhòu", german: "Klima\tmit\nUmbruch" }]);
  const lines = tsv.trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(lines[0], "气候\tqìhòu\tKlima mit Umbruch");
});
