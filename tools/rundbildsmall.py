"""Ritar ett rum som en skuggad grå låda i equirektangulär projektion, som mall åt Gemini.

Mallen är en enkel 3D-bild av det tomma rummet: väggarna är ljusast mitt för
lampan och mörkare mot hörnen, och hörnen är skarpa mörka linjer. Med platta
färgfält läste Gemini väggarnas bågar som extra hörn. Med skuggningen blev det
fyra hörn (2026-11-20). Gråskalan visar bara form och läge, inte färg.
Bilden ritas direkt i 16:9, samma format som Gemini svarar i.

Körs med: python3 tools/rundbildsmall.py ut.png [rum], där rum är hallen, salongen, koket eller sovrummet.
CX och CZ i miljön flyttar betraktaren i meter från mitten, till exempel
CZ=-1.3 för en bit in från ytterdörren. Rummet nedan är hallen.
"""
import os
import sys
import numpy as np
from PIL import Image
W, H = 2752, 1536
EYE, CEIL, HALF = 1.6, 3.0, 2.5
lon = (np.arange(W)+0.5)/W*2*np.pi-np.pi
lat = np.pi/2-(np.arange(H)+0.5)/H*np.pi
LON, LAT = np.meshgrid(lon, lat)
dx, dy, dz = np.cos(LAT)*np.sin(LON), np.sin(LAT), np.cos(LAT)*np.cos(LON)
np.seterr(divide='ignore', invalid='ignore')
CX, CZ = float(os.environ.get('CX',0)), float(os.environ.get('CZ',0))
cands = {'back': np.where(dz>0, (HALF-CZ)/dz, np.inf), 'front': np.where(dz<0, (-HALF-CZ)/dz, np.inf),
 'right': np.where(dx>0, (HALF-CX)/dx, np.inf), 'left': np.where(dx<0, (-HALF-CX)/dx, np.inf),
 'ceil': np.where(dy>0, (CEIL-EYE)/dy, np.inf), 'floor': np.where(dy<0, -EYE/dy, np.inf)}
names = list(cands); T = np.stack([cands[n] for n in names]); idx = T.argmin(0); t = T.min(0)
X, Y, Z = dx*t+CX, dy*t+EYE, dz*t+CZ
normals = {'back':(0,0,-1),'front':(0,0,1),'right':(-1,0,0),'left':(1,0,0),'ceil':(0,-1,0),'floor':(0,1,0)}
base = {'back':205,'front':205,'right':205,'left':205,'ceil':230,'floor':150}
L = np.array([0,2.8,0.0])
img = np.zeros((H,W))
for i,n in enumerate(names):
    m = idx==i
    nx,ny,nz = normals[n]
    lx,ly,lz = L[0]-X[m], L[1]-Y[m], L[2]-Z[m]; d = np.sqrt(lx*lx+ly*ly+lz*lz)
    lam = np.clip((nx*lx+ny*ly+nz*lz)/d, 0, 1)
    img[m] = base[n]*(0.35+0.75*lam/(0.6+0.15*d*d))
img = np.clip(img,0,255)
def onwall(w): return idx==names.index(w)
def rect(w,a,b,h0,h1,val,coord,frame=True):
    m = onwall(w)&(coord>min(a,b))&(coord<max(a,b))&(Y>h0)&(Y<h1)
    img[m] = img[m]*val
    if frame:
        e = onwall(w)&(((abs(coord-a)<0.015)|(abs(coord-b)<0.015))&(Y>h0)&(Y<h1) | ((abs(Y-h1)<0.015)|(abs(Y-h0)<0.015))&(coord>min(a,b))&(coord<max(a,b)))
        img[e] = 25
fl = onwall('floor')
# golvbrädor längs z
img[fl & (abs((X*8)%1-0.5)>0.47)] *= 0.7
def rug(x0, z0, half):
    m = fl&(abs(X-x0)<half)&(abs(Z-z0)<half); img[m] = 110
    img[fl&((abs(abs(X-x0)-half)<0.02)&(abs(Z-z0)<half)|(abs(abs(Z-z0)-half)<0.02)&(abs(X-x0)<half))] = 30
def floorbox(x0, x1, z0, z1, val):
    img[fl&(X>x0)&(X<x1)&(Z>z0)&(Z<z1)] = val
def hallen():
    rug(0, 0, 1.5)
    rect('back',-1.8,-0.4,0,1.3,0.35,X)   # piano
    rect('back',0.5,1.4,0,2.1,0.6,X)      # salongsdörr
    rect('back',1.55,2.4,0,2.1,0.6,X)     # köksdörr
    rect('right',1.0,-0.3,0,1.0,0.5,Z)    # hallsoffa
    rect('right',-1.4,-2.3,0,2.1,0.4,Z)   # källardörr
    rect('left',-2.3,-1.4,0,2.1,0.6,Z)    # sovrumsdörr
    rect('left',0.0,0.9,0,0.8,0.55,Z)     # bord
    rect('left',0.1,0.8,1.2,1.9,1.2,Z)    # spegel
    rect('front',-0.7,0.0,0,2.3,0.6,X)    # ytterdörr, pardörr
    rect('front',0.0,0.7,0,2.3,0.6,X)
    rect('front',0.95,1.7,1.1,1.8,0.7,X)   # krokar
    rect('front',-1.7,-0.95,1.1,1.8,0.7,X)
    floorbox(-1.3,-0.9,1.85,2.25,60)       # pianopall
def salongen():
    # Bordet står mitt i rummet, så betraktaren står mellan bordet och
    # dörren till hallen: CZ=-1.0.
    rug(0, 0, 1.5)
    floorbox(-0.45,0.45,-0.45,0.45,70)     # runt bord med ouijabrädet
    for x0, z0 in [(0,0.75),(-0.71,0.23),(-0.44,-0.61),(0.44,-0.61),(0.71,0.23)]:
        floorbox(x0-0.18,x0+0.18,z0-0.18,z0+0.18,45)   # fem stolar
    rect('back',-1.9,-0.9,0.8,2.5,1.15,X)  # fönster
    rect('back',0.9,1.9,0.8,2.5,1.15,X)    # fönster
    rect('back',-0.3,0.3,0,2.2,0.4,X)      # golvur
    rect('left',2.3,1.4,0,2.1,0.6,Z)       # dörr till sovrummet
    rect('left',-1.6,0.6,0,0.9,0.5,Z)      # soffa
    rect('left',-1.2,0.2,1.3,2.0,0.75,Z)   # tavla
    rect('right',2.3,1.4,0,2.1,0.6,Z)      # dörr till köket
    rect('right',0.6,-1.2,0,0.95,0.5,Z)    # skänk
    rect('front',0.5,1.4,0,2.1,0.6,X)      # dörr till hallen
    rect('front',-2.0,-0.8,0,2.0,0.45,X)   # vitrinskåp
def koket():
    rug(0, 0, 1.0)
    rect('back',-2.3,-1.4,0,2.1,0.6,X)     # dörr till salongen
    rect('back',0.0,1.6,0,0.9,0.5,X)       # diskbänk med diskho
    rect('back',0.2,1.4,1.1,2.2,1.15,X)    # fönster
    rect('right',0.6,1.7,0,0.9,0.35,Z)     # spis
    rect('right',-1.8,0.4,0,0.9,0.5,Z)     # arbetsbänk
    rect('right',-1.6,0.2,1.4,2.1,0.6,Z)   # väggskåp
    rect('left',-0.45,0.45,0,2.1,0.6,Z)    # dörr till hallen
    rect('left',1.0,1.8,1.3,2.0,0.75,Z)    # tavla
    rect('front',-2.3,-1.4,0,2.2,0.55,X)   # skafferi
    rect('front',-1.0,0.4,0,0.8,0.5,X)     # köksbord vid väggen
    rect('front',1.3,1.9,1.4,2.0,0.4,X)    # proppskåp
def sovrummet():
    rug(0, 0, 1.25)
    rect('back',-0.7,0.7,0.9,2.3,1.15,X)   # fönster
    rect('back',1.4,2.3,0,2.1,0.6,X)       # dörr till salongen
    rect('left',-0.6,1.0,0,1.0,0.5,Z)      # säng, huvudgavel mot väggen
    floorbox(-2.5,-0.9,-0.6,1.0,90)
    rect('left',1.2,1.7,0,0.6,0.5,Z)       # nattduksbord
    rect('right',0.2,1.4,0,1.0,0.45,Z)     # byrå
    rect('right',0.3,1.3,1.3,2.0,0.75,Z)   # tavla över byrån
    rect('right',-2.3,-1.4,0,2.1,0.6,Z)    # dörr till hallen
    rect('front',-2.3,0.8,0,2.4,0.5,X)     # bokhyllor från biblioteket
    rect('front',1.2,2.0,0,1.0,0.55,X)     # fåtölj
ROOMS = {'hallen': hallen, 'salongen': salongen, 'koket': koket, 'sovrummet': sovrummet}
ROOMS[sys.argv[2] if len(sys.argv) > 2 else 'hallen']()
# hörn, golvlist och taklist
wall = idx<4
edge = wall&(abs(abs(X)-HALF)<0.012)&(abs(abs(Z)-HALF)<0.012)
edge |= wall&((Y<0.03)|(Y>CEIL-0.03))
img[edge] = 15
# taklampa
lamp = onwall('ceil')&(X*X+Z*Z<0.09); img[lamp] = 250
Image.fromarray(img.astype('uint8')).convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else 'rundbildsmall.png')
