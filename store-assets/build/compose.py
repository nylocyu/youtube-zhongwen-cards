import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BUILD = os.path.dirname(os.path.abspath(__file__))
PANELS = os.path.join(BUILD, "panels")
OUT = os.path.abspath(os.path.join(BUILD, "..", "out"))
os.makedirs(OUT, exist_ok=True)

GF = "/usr/share/fonts/truetype/google-fonts/"
BOLD = GF + "Poppins-Bold.ttf"
MED = GF + "Poppins-Medium.ttf"
REG = GF + "Poppins-Regular.ttf"
CJK_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

BG = (246, 244, 241)
INK = (22, 19, 15)
MUTED = (98, 92, 85)
ACCENT = (192, 57, 43)

W, H = 1280, 800
SS = 2  # supersampling factor for crisp text and shapes


def f(path, size, index=None):
    if index is not None:
        return ImageFont.truetype(path, size, index=index)
    return ImageFont.truetype(path, size)


def rounded_shadow(canvas, box, radius, blur=26, offset=(0, 12), alpha=52):
    """Soft drop shadow behind a rounded card."""
    x0, y0, x1, y1 = box
    pad = blur * 3
    layer = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        [x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]],
        radius=radius,
        fill=(30, 22, 18, alpha),
    )
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer)
    return pad


def round_corners(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def blob(canvas, cx, cy, r, color, alpha, blur=90):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def brand_mark(canvas, x, y, size):
    """Rounded accent square with the 詞 glyph."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([x, y, x + size, y + size], radius=int(size * 0.26), fill=ACCENT + (255,))
    glyph = f(CJK_SERIF, int(size * 0.62), index=1)  # TC face
    bbox = d.textbbox((0, 0), "詞", font=glyph)
    gw, gh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        (x + (size - gw) / 2 - bbox[0], y + (size - gh) / 2 - bbox[1]),
        "詞",
        font=glyph,
        fill=(255, 255, 255, 255),
    )
    canvas.alpha_composite(layer)


def draw_block(d, x, y, lines, font, fill, line_height):
    for i, line in enumerate(lines):
        d.text((x, y + i * line_height), line, font=font, fill=fill)
    return y + len(lines) * line_height


def wrap(text, font, max_width, draw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


SHOTS = [
    ("01-video-to-flashcards.png", "setup",
     ["Turn any YouTube video", "into HSK flashcards"],
     "Open a video with captions and pick your level: HSK 1 to 9, simplified or traditional, 10 to 50 words."),
    ("02-words-from-transcript.png", "results",
     ["Words that actually", "appear in the video"],
     "For Chinese videos every word is matched against the official HSK list. Nothing is invented."),
    ("03-example-sentences.png", "sentences",
     ["Example sentences,", "straight from the video"],
     "Each card can carry a sentence taken verbatim from the transcript, with pinyin and translation."),
    ("04-anki-export.png", "export",
     ["One click to an", "Anki-ready deck"],
     "Export a .tsv file with hanzi, pinyin and translation, plus sentence columns when you want them."),
    ("05-privacy.png", "options",
     ["Your keys.", "Your data. No server."],
     "Bring your own Supadata and Anthropic API keys. Everything stays in your browser: no account, no analytics, no tracking."),
]


def compose(out_name, panel_name, headline_lines, sub):
    c = Image.new("RGBA", (W * SS, H * SS), BG + (255,))

    # warm accent glow behind the panel column
    blob(c, int(950 * SS), int(330 * SS), int(420 * SS), ACCENT, 26, blur=120 * SS)
    blob(c, int(1180 * SS), int(720 * SS), int(300 * SS), (214, 168, 60), 20, blur=110 * SS)

    d = ImageDraw.Draw(c)

    left_x = 96 * SS
    col_w = 492 * SS

    brand_mark(c, left_x, 250 * SS, 46 * SS)

    # shrink the headline until the longest line fits the left column
    size = 44
    while size > 26:
        h_font = f(BOLD, size * SS)
        if max(d.textlength(l, font=h_font) for l in headline_lines) <= col_w:
            break
        size -= 1
    line_h = int(size * 1.3) * SS
    s_font = f(REG, 18 * SS)

    y = 330 * SS
    y = draw_block(d, left_x, y, headline_lines, h_font, INK, line_h)

    y += 14 * SS
    sub_lines = wrap(sub, s_font, col_w, d)
    draw_block(d, left_x, y, sub_lines, s_font, MUTED, 30 * SS)

    # panel card
    panel = Image.open(os.path.join(PANELS, panel_name + ".png")).convert("RGBA")
    max_w, max_h = 560 * SS, 660 * SS
    scale = min(max_w / panel.width, max_h / panel.height)
    pw, ph = int(panel.width * scale), int(panel.height * scale)
    panel = panel.resize((pw, ph), Image.LANCZOS)

    cx, cy = int(895 * SS), int(400 * SS)
    x0, y0 = cx - pw // 2, cy - ph // 2
    radius = int(16 * SS)

    rounded_shadow(c, (x0, y0, x0 + pw, y0 + ph), radius,
                   blur=int(22 * SS), offset=(0, int(14 * SS)), alpha=46)
    c.alpha_composite(round_corners(panel, radius), (x0, y0))

    # hairline border on the card
    ImageDraw.Draw(c).rounded_rectangle(
        [x0, y0, x0 + pw - 1, y0 + ph - 1], radius=radius, outline=(0, 0, 0, 26), width=max(1, SS)
    )

    final = c.convert("RGB").resize((W, H), Image.LANCZOS)
    final.save(os.path.join(OUT, out_name))
    print("wrote", out_name, final.size)


for args in SHOTS:
    compose(*args)
