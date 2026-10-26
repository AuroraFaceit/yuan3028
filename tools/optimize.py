import os, sys
from PIL import Image

SRC = r"C:/Users/watch/WorkBuddy/2026-10-25-16-02-14/site/assets/img"
DST = r"C:/Users/watch/WorkBuddy/2026-10-25-16-02-14/site/assets/opt"
MAXW = 1600
QUAL = 80

total_in = total_out = 0
for root, _, files in os.walk(SRC):
    for fn in sorted(files):
        p = os.path.join(root, fn)
        rel = os.path.relpath(p, SRC)
        out = os.path.join(DST, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        try:
            im = Image.open(p)
            im = im.convert("RGB")
            w, h = im.size
            if max(w, h) > MAXW:
                r = MAXW / max(w, h)
                im = im.resize((round(w*r), round(h*r)), Image.LANCZOS)
            im.save(out, "JPEG", quality=QUAL, optimize=True, progressive=True)
            i, o = os.path.getsize(p), os.path.getsize(out)
            total_in += i; total_out += o
            print(f"{rel}: {w}x{h} {i//1024}KB -> {im.size[0]}x{im.size[1]} {o//1024}KB")
        except Exception as e:
            print(f"{rel}: ERROR {e}")
print(f"TOTAL: {total_in//1024//1024}MB -> {total_out//1024//1024}MB")
