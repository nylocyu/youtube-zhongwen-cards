import asyncio, os
from playwright.async_api import async_playwright

BUILD = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(BUILD, "ui")
OUT = os.path.join(BUILD, "panels")
os.makedirs(OUT, exist_ok=True)

# (file, css width, out name) — height auto-fits the content
SHOTS = [
    ("setup.html", 400, "setup"),
    ("results.html", 400, "results"),
    ("sentences.html", 400, "sentences"),
    ("options.html", 464, "options"),
    ("export.html", 452, "export"),
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
        )
        for src, width, name in SHOTS:
            page = await browser.new_page(
                viewport={"width": width, "height": 900},
                device_scale_factor=3,
            )
            await page.goto("file://" + os.path.join(UI, src))
            await page.wait_for_timeout(300)
            h = await page.evaluate("document.body.scrollHeight")
            await page.set_viewport_size({"width": width, "height": int(h)})
            await page.wait_for_timeout(150)
            path = os.path.join(OUT, name + ".png")
            await page.screenshot(path=path, full_page=True)
            print(name, width, "x", h)
            await page.close()
        await browser.close()


asyncio.run(main())
