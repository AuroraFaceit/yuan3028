import os, json, math
import cv2, numpy as np

ROOT = r'C:/Users/watch/WorkBuddy/2026-10-25-16-02-14'
WEB = os.path.join(ROOT, 'site/assets/web')

def strip_scores(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (320, 320), interpolation=cv2.INTER_AREA)
    edges = cv2.Canny(g, 45, 140)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=45, minLineLength=70, maxLineGap=7)
    h = 0.0
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4):
            ang = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
            if ang > 90:
                ang = 180 - ang
            if ang < 9:
                h += math.hypot(x2 - x1, y2 - y1)
    top = g[:90, :].astype(np.float32)
    bot = g[230:, :].astype(np.float32)
    sb = (top.mean() - bot.mean()) / 255.0
    vt = cv2.Laplacian(top, cv2.CV_32F).var()
    vb = cv2.Laplacian(bot, cv2.CV_32F).var()
    smooth = (vb - vt) / (vb + vt + 1.0)
    return h / 320.0, sb, smooth

def total(s):
    h, sb, sm = s
    return h * 1.0 + 2.2 * sb + 0.7 * sm

rows = []
for slug in ['pink', 'sunrise', 'dusk', 'daily', 'sky', 'flower']:
    d = os.path.join(WEB, slug)
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith('.jpg'):
            continue
        p = os.path.join(d, fn)
        img = cv2.imread(p)
        scores = {}
        for rot in (0, 90, 180, 270):
            if rot == 0:
                r = img
            elif rot == 90:
                r = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            elif rot == 180:
                r = cv2.rotate(img, cv2.ROTATE_180)
            else:
                r = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
            scores[rot] = strip_scores(r)
        best = max(scores, key=lambda k: total(scores[k]))
        rows.append({
            'file': f'{slug}/{fn}', 'h': img.shape[0], 'w': img.shape[1],
            'best': best,
            'gain': round(total(scores[best]) - total(scores[0]), 3),
            'detail': {k: [round(x, 2) for x in v] for k, v in scores.items()},
        })

rows.sort(key=lambda r: -r['gain'])
for r in rows:
    print(f"{r['file']:<22} {r['w']}x{r['h']} best={r['best']:>3} gain={r['gain']:+.2f}  " +
          '  '.join(f"{k}:{v[0]:.1f}/{v[1]:+.2f}/{v[2]:+.2f}" for k, v in r['detail'].items()))
json.dump(rows, open(os.path.join(ROOT, 'tmp/orient.json'), 'w'), ensure_ascii=False, indent=1)
