"""
TVC Digital Twin — Offline Map Tile Downloader
Run this once during installation to pre-cache OpenStreetMap tiles.
Usage: python download_tiles.py [--lat LAT] [--lon LON] [--radius RADIUS]
"""

import os
import sys
import math
import time
import argparse
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────
DEFAULT_LAT  = 23.80388      # Default: Mirpur City Club Field, Dhaka, Bangladesh
DEFAULT_LON  = 90.36277
ZOOM_MIN     = 8
ZOOM_MAX     = 16
TILE_RADIUS  = 4             # tiles on each side of center per zoom level
RATE_LIMIT_S = 0.05          # seconds between requests (respect OSM policy)
OSM_HEADERS  = {"User-Agent": "TVC-DigitalTwin-ProjectNeal/1.0 (offline-cache)"}

# ── Helpers ───────────────────────────────────────────────────────────────────
def lat_lon_to_tile(lat: float, lon: float, zoom: int):
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return x, y

def download_tile(z: int, x: int, y: int, out_dir: str) -> bool:
    path = os.path.join(out_dir, str(z), str(x), f"{y}.png")
    if os.path.exists(path):
        return False  # already cached

    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

    try:
        req = urllib.request.Request(url, headers=OSM_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            with open(path, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"  WARNING: Failed {z}/{x}/{y}: {e}")
        return False

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Download offline map tiles")
    parser.add_argument("--lat",    type=float, default=DEFAULT_LAT)
    parser.add_argument("--lon",    type=float, default=DEFAULT_LON)
    parser.add_argument("--radius", type=int,   default=TILE_RADIUS)
    parser.add_argument("--zmin",   type=int,   default=ZOOM_MIN)
    parser.add_argument("--zmax",   type=int,   default=ZOOM_MAX)
    parser.add_argument("--out",    type=str,   default=None,
                        help="Output directory (default: webapp/frontend/dist/tiles/)")
    args = parser.parse_args()

    # Resolve output directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = args.out or os.path.join(script_dir, "webapp", "frontend", "dist", "tiles")

    print("TVC Digital Twin -- Offline Tile Downloader")
    print(f"Center : {args.lat:.6f} N, {args.lon:.6f} E")
    print(f"Zoom   : {args.zmin} -> {args.zmax}")
    print(f"Radius : +-{args.radius} tiles per zoom level")
    print(f"Output : {out_dir}")
    print()

    total = 0
    downloaded = 0

    for z in range(args.zmin, args.zmax + 1):
        cx, cy = lat_lon_to_tile(args.lat, args.lon, z)
        r = min(args.radius, 2 ** z - 1)  # clamp to valid tile range

        tiles = [
            (z, cx + dx, cy + dy)
            for dx in range(-r, r + 1)
            for dy in range(-r, r + 1)
            if 0 <= cx + dx < 2**z and 0 <= cy + dy < 2**z
        ]

        print(f"  Zoom {z:2d}: center ({cx},{cy}), {len(tiles)} tiles", end="", flush=True)

        for z_, x, y in tiles:
            got = download_tile(z_, x, y, out_dir)
            if got:
                downloaded += 1
                time.sleep(RATE_LIMIT_S)
            total += 1

        print(" -- done")

    print()
    print(f"Complete: {downloaded} new tiles downloaded ({total} total checked)")
    print(f"Tiles saved to: {out_dir}")

if __name__ == "__main__":
    main()
