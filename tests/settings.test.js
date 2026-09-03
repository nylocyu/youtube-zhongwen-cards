const test = require("node:test");
const assert = require("node:assert/strict");
const ZWC_SETTINGS = require("../settings.js");

test("normalize: fills in defaults for empty input", () => {
  const result = ZWC_SETTINGS.normalize({});
  assert.equal(result.supadataApiKey, "");
  assert.equal(result.anthropicApiKey, "");
  assert.equal(result.defaultLevel, 3);
  assert.equal(result.defaultScript, "simplified");
  assert.equal(result.defaultCount, 20);
  assert.equal(result.uiLanguage, "de");
});

test("normalize: clamps defaultCount to [10, 50]", () => {
  assert.equal(ZWC_SETTINGS.normalize({ defaultCount: 5 }).defaultCount, 10);
  assert.equal(ZWC_SETTINGS.normalize({ defaultCount: 500 }).defaultCount, 50);
  assert.equal(ZWC_SETTINGS.normalize({ defaultCount: "not-a-number" }).defaultCount, 20);
});

test("normalize: clamps defaultLevel to [1, 7]", () => {
  assert.equal(ZWC_SETTINGS.normalize({ defaultLevel: 0 }).defaultLevel, 1);
  assert.equal(ZWC_SETTINGS.normalize({ defaultLevel: 99 }).defaultLevel, 7);
});

test("normalize: only accepts 'traditional' as non-default script", () => {
  assert.equal(ZWC_SETTINGS.normalize({ defaultScript: "traditional" }).defaultScript, "traditional");
  assert.equal(ZWC_SETTINGS.normalize({ defaultScript: "bogus" }).defaultScript, "simplified");
});

test("normalize: only accepts 'en' as non-default uiLanguage", () => {
  assert.equal(ZWC_SETTINGS.normalize({ uiLanguage: "en" }).uiLanguage, "en");
  assert.equal(ZWC_SETTINGS.normalize({ uiLanguage: "bogus" }).uiLanguage, "de");
});

test("normalize: trims string keys, ignores unknown fields", () => {
  const result = ZWC_SETTINGS.normalize({
    supadataApiKey: "  abc  ",
    unknownField: "should be dropped",
  });
  assert.equal(result.supadataApiKey, "abc");
  assert.equal("unknownField" in result, false);
});

test("hasRequiredKeys: true only when both keys are present", () => {
  assert.equal(ZWC_SETTINGS.hasRequiredKeys({ supadataApiKey: "a", anthropicApiKey: "b" }), true);
  assert.equal(ZWC_SETTINGS.hasRequiredKeys({ supadataApiKey: "a", anthropicApiKey: "" }), false);
  assert.equal(ZWC_SETTINGS.hasRequiredKeys({}), false);
});
