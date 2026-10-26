"""Generate self-contained raster PWA icons from the app's laboratory motif."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"

def icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), "#080c17")
    draw = ImageDraw.Draw(image)
    scale = size / 512
    def xy(values): return tuple(round(value * scale) for value in values)
    draw.rounded_rectangle(xy((0, 0, 512, 512)), radius=round(96 * scale), fill="#080c17")
    blue, violet, mint = "#60a5fa", "#a78bfa", "#34d399"
    draw.rounded_rectangle(xy((195, 100, 317, 165)), radius=round(12 * scale), outline=blue, width=round(18 * scale))
    draw.line([xy((180, 160)), xy((180, 280)), xy((100, 400)), xy((108, 424)), xy((404, 424)), xy((412, 400)), xy((332, 280)), xy((332, 160))], fill=violet, width=round(18 * scale), joint="curve")
    draw.polygon([xy((148, 370)), xy((120, 400)), xy((128, 422)), xy((384, 422)), xy((392, 400)), xy((364, 370))], fill="#4f70c4")
    for cx, cy, radius, color in [(210, 350, 12, blue), (260, 320, 8, violet), (310, 355, 10, blue)]:
        draw.ellipse(xy((cx-radius, cy-radius, cx+radius, cy+radius)), fill=color)
    draw.ellipse(xy((324, 92, 436, 204)), fill="#0f1623", outline=violet, width=round(10 * scale))
    draw.line([xy((380, 148)), xy((380, 110))], fill=mint, width=round(7 * scale))
    draw.line([xy((380, 148)), xy((408, 162))], fill=mint, width=round(5 * scale))
    return image

for dimension in (192, 512):
    icon(dimension).save(OUT / f"icon-{dimension}.png", "PNG", optimize=True)
