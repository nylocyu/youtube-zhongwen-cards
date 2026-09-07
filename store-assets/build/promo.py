import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BUILD = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(BUILD, "..", "out"))
os.makedirs(OUT, exist_ok=True)

GF = "/usr/share/fonts/truetype/google-fonts/"
BOLD = GF + "Poppins-Bold.ttf"
MED = GF + "Poppins-Medium.ttf"
REG = GF + "Poppins-Regular.ttf"
CJK_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
TC = 1  # Noto Serif CJK TC face index

ACCENT = (192, 57, 43)
DEEP = (150, 40, 30)
CREAM = (250, 247, 243)

SS = 3


def f(path, size, index=None):
    return ImageFont.truetype(path, size, index=index) if index is not None else ImageFont.truetype(path, size)


def centered_glyph(d, box, text, font, fill):
    x0, y0, x1, y1 = box
    b = d.textbbox((0, 0), text, font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text((x0 + (x1 - x0 - w) / 2 - b[0], y0 + (y1 - y0 - h) / 2 - b[1]), text, font=font, fill=fill)


def promo(w, h, out_name, glyph_size, head_size, sub_size, heads, sub, pad_x):
    c = Image.new("RGBA", (w * SS, h * SS), ACCENT + (255,))

    # depth: darker blob bottom-left, lighter warmth top-right
    layer = Image.new("RGBA", c.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [-int(0.25 * w * SS), int(0.45 * h * SS), int(0.55 * w * SS), int(1.7 * h * SS)],
        fill=DEEP + (150,),
    )
    ImageDraw.Draw(layer).ellipse(
        [int(0.62 * w * SS), -int(0.55 * h * SS), int(1.35 * w * SS), int(0.75 * h * SS)],
        fill=(226, 106, 88, 90),
    )
    c.alpha_composite(layer.filter(ImageFilter.GaussianBlur(int(0.13 * w * SS))))

    d = ImageDraw.Draw(c)

    # wordmark glyph, straight on the red
    plate = int(glyph_size * 1.35)
    px, py = pad_x * SS, (h * SS - plate) // 2
    centered_glyph(d, (px, py, px + plate, py + plate), "詞", f(CJK_SERIF, glyph_size, index=TC), (255, 255, 255, 255))

    tx = px + plate + int(0.055 * w * SS)
    h_font = f(BOLD, head_size)
    s_font = f(MED, sub_size)

    total = len(heads) * int(head_size * 1.26) + int(sub_size * 2.2)
    y = (h * SS - total) // 2
    for line in heads:
        d.text((tx, y), line, font=h_font, fill=(255, 255, 255, 255))
        y += int(head_size * 1.26)
    y += int(sub_size * 0.75)
    d.text((tx, y), sub, font=s_font, fill=(255, 255, 255, 200))

    final = c.convert("RGB").resize((w, h), Image.LANCZOS)
    final.save(os.path.join(OUT, out_name))
    print("wrote", out_name, final.size)


# Mandatory small promo tile
promo(
    440, 280, "promo-tile-440x280.png",
    glyph_size=76 * SS, head_size=25 * SS, sub_size=12 * SS,
    heads=["HSK flashcards", "from YouTube"],
    sub="Hanzi · pinyin · Anki export",
    pad_x=30,
)

# Optional marquee
promo(
    1400, 560, "promo-marquee-1400x560.png",
    glyph_size=190 * SS, head_size=58 * SS, sub_size=25 * SS,
    heads=["HSK flashcards", "from any YouTube video"],
    sub="Hanzi · pinyin · example sentences · one-click Anki export",
    pad_x=110,
)


# 128x128 store icon: 96x96 artwork + 16px transparent padding
def store_icon():
    s = 128 * SS
    art = 96 * SS
    pad = 16 * SS
    c = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([pad, pad, pad + art, pad + art], radius=int(art * 0.24), fill=ACCENT + (255,))
    centered_glyph(d, (pad, pad, pad + art, pad + art), "詞",
                   f(CJK_SERIF, int(art * 0.62), index=TC), (255, 255, 255, 255))
    c.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, "store-icon-128.png"))
    print("wrote store-icon-128.png (128, 128)")


store_icon()
