import os, json
from PIL import Image, ImageOps

BASE = r"C:/Users/watch/WorkBuddy/2026-10-25-16-02-14/site"
SRC = os.path.join(BASE, "assets/img")
DST = os.path.join(BASE, "assets/web")

CATS = [
    ("pink",   "粉色"),
    ("sunrise","日出"),
    ("dusk",   "晚"),
    ("daily",  "日常"),
    ("sky",    "天空"),
    ("flower", "花"),
]

# 手动摆正表：键为输出文件名（不含扩展名），值为逆时针旋转角度
# 90 = 逆时针转 90°（照片原本横躺着时用），270 = 顺时针转 90°，180 = 上下颠倒
ROTATE = {
    "dusk-05": 90,
}

os.makedirs(DST, exist_ok=True)
manifest = {}
for slug, cn in CATS:
    files = sorted(os.listdir(os.path.join(SRC, cn)))
    outdir = os.path.join(DST, slug)
    os.makedirs(outdir, exist_ok=True)
    items = []
    n = 0
    for fn in files:
        if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        n += 1
        name = f"{slug}-{n:02d}.jpg"
        src = os.path.join(SRC, cn, fn)
        im = Image.open(src)
        im = ImageOps.exif_transpose(im).convert("RGB")
        deg = ROTATE.get(name[:-4])
        if deg:
            im = im.rotate(deg, expand=True)
        w, h = im.size
        if max(w, h) > 1200:
            r = 1200 / max(w, h)
            im = im.resize((round(w * r), round(h * r)), Image.LANCZOS)
        im.save(os.path.join(outdir, name), "JPEG", quality=78, optimize=True, progressive=True)
        items.append({"file": f"assets/web/{slug}/{name}", "w": im.size[0], "h": im.size[1]})
        if deg:
            print("  rotated", name, deg)
    manifest[slug] = items
    print(slug, cn, len(items))

with open(os.path.join(BASE, "js", "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print("done")
