const test = require("node:test");
const assert = require("node:assert/strict");
const ZWC_I18N = require("../i18n.js");

test("t: returns the requested language's string", () => {
  assert.equal(ZWC_I18N.t("de", "saveButton"), "Speichern");
  assert.equal(ZWC_I18N.t("en", "saveButton"), "Save");
});

test("t: substitutes {placeholder} params", () => {
  assert.equal(
    ZWC_I18N.t("en", "resultsSummary", { count: 5, caseLabel: "from the transcript" }),
    "5 words (from the transcript)"
  );
});

test("t: falls back to German, then the bare key, for anything unresolvable", () => {
  assert.equal(ZWC_I18N.t("fr", "saveButton"), "Speichern");
  assert.equal(ZWC_I18N.t("de", "totallyUnknownKey"), "totallyUnknownKey");
});

test("STRINGS.de and STRINGS.en cover exactly the same set of keys", () => {
  const deKeys = Object.keys(ZWC_I18N.STRINGS.de).sort();
  const enKeys = Object.keys(ZWC_I18N.STRINGS.en).sort();
  assert.deepEqual(deKeys, enKeys);
});
