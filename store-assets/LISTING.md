# Chrome Web Store listing — copy & answers

Paste-ready content for the Developer Dashboard. Nothing here ships in the
extension ZIP.

Published listing: <https://chromewebstore.google.com/detail/pepinhonjmmfbfdllnlfcoadhjemihac>

Before the first submission: developer account ($5 one-time), **2-Step
Verification enabled** on the Google account (mandatory to publish or update),
and a verified contact email — all review and rejection mail goes only there.

---

## Store listing tab

**Language:** English (United States)
**Category:** Education

**Name** (from `manifest.json`, 35/75 chars):

```
詞 — Chinese Flashcards for YouTube™
```

**Summary** (from `manifest.json`, 96/132 chars):

```
Turn any YouTube video into HSK-graded Chinese vocabulary flashcards, ready to import into Anki.
```

**Detailed description:**

```
Requires two free-tier API keys of your own — Supadata (transcripts) and
Anthropic (translation). There is no account to create and no server of ours;
your keys stay in local Chrome storage on this device.

詞 turns any YouTube video into Chinese vocabulary flashcards graded to your HSK
level, and exports them as a TSV file you import straight into Anki.

HOW IT WORKS
Open a video with captions, click the 詞 button next to Like/Share, pick your
level and how many words you want, and generate.

• If the video is in Chinese, the words are matched directly against the
  transcript — you learn the vocabulary that was actually spoken.
• If the video is in any other language, Claude picks words from the official
  HSK list that fit the video's topic.

WHAT YOU GET
• HSK 1–6, plus the merged advanced 7–9 band
• Simplified or traditional characters
• 10 to 50 words per video
• Optional example sentences with pinyin and translation — for Chinese videos
  the sentence is quoted verbatim from the transcript
• One-click TSV export: hanzi, pinyin, translation (plus three sentence columns
  when enabled)
• English or German as your translation language

ACCURATE BY CONSTRUCTION
Characters, pinyin and HSK level always come from a bundled copy of the official
HSK word list, never from the language model. Any word the model returns that
isn't in that list is discarded, so you never study an invented word.

PRIVACY
No analytics, no telemetry, no tracking, no server of ours. The only network
requests go to Supadata and Anthropic, using the keys you configured yourself.
Full details: https://github.com/nylocyu/youtube-zhongwen-cards/blob/main/PRIVACY.md

Open source (MIT): https://github.com/nylocyu/youtube-zhongwen-cards

Not affiliated with, endorsed by, or sponsored by Google or YouTube. YouTube is
a trademark of Google LLC.
```

**Images** — all in this folder:

| Field | File |
| --- | --- |
| Store icon | `store-icon-128.png` (padded variant — *not* `icons/icon128.png`) |
| Screenshot 1 | `01-video-to-flashcards.png` |
| Screenshot 2 | `02-words-from-transcript.png` |
| Screenshot 3 | `03-example-sentences.png` |
| Screenshot 4 | `04-anki-export.png` |
| Screenshot 5 | `05-privacy.png` |
| Small promo tile (required) | `promo-tile-440x280.png` |
| Marquee (optional) | `promo-marquee-1400x560.png` |

---

## Privacy tab

**Single purpose:**

```
Turn the Chinese vocabulary spoken in a YouTube video into HSK-graded flashcards
the user can export to Anki.
```

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's own API keys, their HSK level / script / word-count preferences, and a 30-day cache of transcripts and generated cards in local extension storage. Nothing is sent to a server of ours; there is none. |
| `sidePanel` | The entire user interface lives in the side panel: level selection, the generated flashcard list, and the export button. |
| `scripting` | Injects a single bundled function into the YouTube page to read the current video's id, title and description from the player object. No remote code is fetched or executed. |
| `downloads` | Saves the generated flashcards as a .tsv file through a Save-as dialog, so the user can import them into Anki. |
| Host `https://*.youtube.com/*` | Needed to place the flashcard button on the watch page and to read the current video's id, title and description. |
| Host `https://api.supadata.ai/*` | Fetches the video's transcript using the user's own Supadata API key. |
| Host `https://api.anthropic.com/*` | Translates and selects the vocabulary using the user's own Anthropic API key. |

**Are you using remote code?** → **No.** Prompts and the HSK word list are
bundled in the package and read via `chrome.runtime.getURL`. API responses are
data that is parsed and validated, never executed.

**Data collection** — declare both of these (under-declaring is a common
takedown cause):

- ☑ **Authentication information** — the user's own Supadata and Anthropic API
  keys, stored locally and sent only to those two services for authentication.
- ☑ **Website content** — the YouTube video's title, a truncated description
  excerpt and transcript text, sent to Supadata and Anthropic to produce the
  flashcards.

Free-text note:

```
Both items are transmitted only to the two services the user configured
themselves, with the user's own API keys. Nothing is sent to the developer —
this extension has no backend, no account system, no analytics and no
telemetry. API keys and cached data are kept in chrome.storage.local (never
chrome.storage.sync) and the cache expires after 30 days.
```

**Certifications** — all three apply (no sale to third parties, no use beyond
the single purpose, no creditworthiness/lending use).

**Privacy policy URL:**

```
https://github.com/nylocyu/youtube-zhongwen-cards/blob/main/PRIVACY.md
```

---

## Test instructions tab

Without working keys the reviewer sees a non-functional extension — the single
most likely rejection reason. Paste this, filling in two keys with a small
spending cap:

```
This extension is bring-your-own-key: it needs a Supadata key (transcripts) and
an Anthropic key (translation). Test keys for review:

  Supadata API key:  <PASTE KEY>
  Anthropic API key: <PASTE KEY>

Steps:
1. Click the extension icon, then the gear icon in the side panel (or open the
   options page) to reach Settings.
2. Paste both keys and click Save.
3. Open this Chinese-language video with captions:
   <PASTE YOUTUBE URL>
4. Click the 詞 button in the video's action row, next to Like and Share.
   (The extension icon in the toolbar opens the same side panel.)
5. Leave the defaults and click "Generate vocabulary". Cards appear after
   roughly 10-30 seconds.
6. "Export as TSV" downloads the flashcard file for Anki.

Note: the extension only activates on youtube.com watch pages.
```

**Rotate both keys once the item is approved.** They must never be committed —
`scripts/check-release.sh` scans the whole tree for exactly these patterns.

---

## Distribution tab

Public, all regions. Choose *deferred publishing* to control the go-live moment
yourself; after approval there are 30 days to publish.

New publishers are limited to two published items by default — not a constraint
for a single extension.
