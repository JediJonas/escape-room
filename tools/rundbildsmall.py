"""Ritar ett rum som en enkel låda i equirektangulär projektion, som mall åt Gemini.

Betraktaren står mitt i ett kvadratiskt rum, så att varje vägg blir en fjärdedel
av varvet. Gemini får mallen tillsammans med prompten och målar rummet på den,
så att hörn, dörrar och möbler hamnar rätt (Jonas 2026-11-20). Färgerna betyder
inget i sig. Prompten säger vad varje färgad yta är.

Körs med: python3 tools/rundbildsmall.py ut.png
Rummet nedan är hallen. Ett annat rum får egna rect-rader.
"""
import sys
import numpy as np
from PIL import Image
W, H = 2752, 1376
EYE, CEIL, HALF = 1.6, 3.0, 2.5
lon = (np.arange(W) + 0.5) / W * 2 * np.pi - np.pi
lat = np.pi / 2 - (np.arange(H) + 0.5) / H * np.pi
LON, LAT = np.meshgrid(lon, lat)
dx, dy, dz = np.cos(LAT) * np.sin(LON), np.sin(LAT), np.cos(LAT) * np.cos(LON)
img = np.zeros((H, W, 3))
np.seterr(divide='ignore', invalid='ignore')
def hit(t):
    return np.where(t > 0, t, np.inf)
ts = {
  'back': hit(HALF / np.where(dz != 0, dz, 1e-9)) * (dz > 0) + np.where(dz > 0, 0, np.inf),
  'front': hit(-HALF / np.where(dz != 0, dz, 1e-9)) * (dz < 0) + np.where(dz < 0, 0, np.inf),
  'right': hit(HALF / np.where(dx != 0, dx, 1e-9)) * (dx > 0) + np.where(dx > 0, 0, np.inf),
  'left': hit(-HALF / np.where(dx != 0, dx, 1e-9)) * (dx < 0) + np.where(dx < 0, 0, np.inf),
  'ceil': hit((CEIL - EYE) / np.where(dy != 0, dy, 1e-9)) * (dy > 0) + np.where(dy > 0, 0, np.inf),
  'floor': hit(-EYE / np.where(dy != 0, dy, 1e-9)) * (dy < 0) + np.where(dy < 0, 0, np.inf),
}
names = list(ts); T = np.stack([np.nan_to_num(ts[n], nan=np.inf, posinf=np.inf) for n in names]); idx = T.argmin(0); t = T.min(0)
X, Y, Z = dx * t, dy * t + EYE, dz * t
WALL = np.array([200, 196, 188]); CEILC = np.array([225, 225, 225]); FLOOR = np.array([150, 120, 90])
DOOR = np.array([110, 70, 40]); FRONTDOOR = np.array([60, 90, 160]); CELLAR = np.array([40, 40, 40])
PIANO = np.array([30, 20, 15]); STOOL = np.array([90, 40, 40]); BENCH = np.array([140, 90, 30]); TABLE = np.array([160, 120, 60])
MIRROR = np.array([170, 210, 230]); HOOKS = np.array([90, 130, 90]); RUG = np.array([170, 60, 60])
img[:] = WALL
img[idx == names.index('ceil')] = CEILC
fl = idx == names.index('floor'); img[fl] = FLOOR
img[fl & (abs(X) < 1.5) & (abs(Z) < 1.5)] = RUG
def rect(wall, a, b, h0, h1, col, coord):
    m = (idx == names.index(wall)) & (coord > min(a, b)) & (coord < max(a, b)) & (Y > h0) & (Y < h1); img[m] = col
rect('back', -1.8, -0.4, 0, 1.3, PIANO, X)
rect('back', 0.5, 1.4, 0, 2.1, DOOR, X)
rect('back', 1.55, 2.4, 0, 2.1, DOOR, X)
rect('right', 1.0, -0.3, 0, 1.2, BENCH, Z)
rect('right', -1.4, -2.3, 0, 2.1, CELLAR, Z)
rect('left', -2.3, -1.4, 0, 2.1, DOOR, Z)
rect('left', 0.0, 0.9, 0, 0.8, TABLE, Z)
rect('left', 0.1, 0.8, 1.2, 1.9, MIRROR, Z)
rect('front', -0.5, 0.5, 0, 2.1, FRONTDOOR, X)
rect('front', 0.7, 1.5, 1.1, 1.8, HOOKS, X)
rect('front', -1.5, -0.7, 1.1, 1.8, HOOKS, X)
# pianopallen på golvet framför pianot
img[fl & (X > -1.3) & (X < -0.9) & (Z > 1.9) & (Z < 2.3)] = STOOL
# hörn och golvlister som mörka linjer
edge = np.zeros((H, W), bool)
for a, b in [(X, HALF), (X, -HALF), (Z, HALF), (Z, -HALF)]:
    edge |= (abs(abs(a) - HALF) < 0.012) & (idx < 4) & (abs(abs(X) - HALF) < 0.012) & (abs(abs(Z) - HALF) < 0.012)
edge |= (idx < 4) & ((Y < 0.02) | (Y > CEIL - 0.02))
img[edge] = 20
Image.fromarray(img.astype('uint8')).save(sys.argv[1] if len(sys.argv) > 1 else 'rundbildsmall.png')
