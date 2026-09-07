# Chrome Web Store assets

Generated listing assets for 詞. All sizes match the Chrome Web Store spec
(PNG, square corners, no padding — except the store icon, which is padded on
purpose).

## What goes where

| File | Size | Where it goes |
| --- | --- | --- |
| `01-video-to-flashcards.png` | 1280×800 | Screenshot 1 (hero — first one shown) |
| `02-words-from-transcript.png` | 1280×800 | Screenshot 2 |
| `03-example-sentences.png` | 1280×800 | Screenshot 3 |
| `04-anki-export.png` | 1280×800 | Screenshot 4 |
| `05-privacy.png` | 1280×800 | Screenshot 5 (max is 5) |
| `promo-tile-440x280.png` | 440×280 | Small promo tile (required) |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo tile (optional, used for featured placements) |
| `store-icon-128.png` | 128×128 | Store icon — 96×96 artwork with 16 px transparent padding, as the store asks for |

`icons/icon128.png` in the extension itself stays as it is; the store icon is a
separate upload and needs the padding.

## Notes

- The UI in the screenshots is rendered from the real `sidepanel.css` /
  `options.css`, with English strings from `i18n.js` and a Taiwan night-market
  video as the example. No live API calls were made, so no real keys or
  transcripts appear anywhere.
- The store icon uses 詞 (traditional), matching the extension name and the
  side panel header. The shipped `icons/icon128.png` uses 词 (simplified) —
  worth aligning one way or the other.
- Screenshots show HSK 4, traditional script, 24 words, example sentences on.

## Regenerating

```bash
cd store-assets/build
python3 render.py    # renders the UI states to build/panels/ via headless Chromium
python3 compose.py   # composes the five 1280x800 screenshots into ../out/
python3 promo.py     # promo tiles + padded store icon into ../out/
```

Headlines and sublines live in the `SHOTS` list in `compose.py`; the mock UI
states are plain HTML in `build/ui/`. Requires Python with Pillow and
Playwright, plus the Noto CJK and Poppins fonts.
