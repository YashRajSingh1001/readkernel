"""Draw ReadKernel's "rk." icon at every size the site and extension need.

    python brand/make_icons.py

The mark is defined once below (on a 64 x 64 grid) and written out as:
  web/app/icon.svg          browser tab icon (modern browsers)
  web/app/favicon.ico       browser tab icon (older browsers; 16, 32, 48 px)
  web/app/apple-icon.png    phone home-screen icon (180 px, square: iOS rounds it)
  extension/icons/*.png     Chrome extension (16, 32, 48, 128 px)

No image library needed: shapes are drawn with plain maths and saved as PNG.
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

INK = (23, 21, 15)
PAPER = (251, 250, 247)
EMBER = (194, 65, 12)
STROKE = 6.0  # letter stroke width, in grid units


def _bezier(p0, p1, p2, p3, steps=16):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t**2, t**3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


# The letters as strokes (polylines) on the 64 grid: "r" then "k", plus the ember full stop.
STROKES = [
    [(13, 48), (13, 26)],  # r stem
    _bezier((13, 32), (15, 27), (19, 25), (24, 26)),  # r shoulder
    [(32, 48), (32, 14)],  # k stem
    [(32, 37), (45, 26)],  # k arm
    [(37, 33), (47, 48)],  # k leg
]
DOT = ((53, 46), 4.5)


def _seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _in_round_rect(x, y, size, r):
    if r == 0:
        return 0 <= x <= size and 0 <= y <= size
    cx, cy = min(max(x, r), size - r), min(max(y, r), size - r)
    return math.hypot(x - cx, y - cy) <= r


def _colour_at(x, y, corner):
    """Colour of one sample point on the 64 grid, or None outside the tile."""
    if not _in_round_rect(x, y, 64, corner):
        return None
    if math.hypot(x - DOT[0][0], y - DOT[0][1]) <= DOT[1]:
        return EMBER
    for line in STROKES:
        for (ax, ay), (bx, by) in zip(line, line[1:]):
            if _seg_dist(x, y, ax, ay, bx, by) <= STROKE / 2:
                return PAPER
    return INK


def render(size: int, corner: float = 14, samples: int = 4) -> bytes:
    """RGBA PNG bytes of the tile at `size` px, anti-aliased by supersampling."""
    scale = 64 / size
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            r = g = b = a = 0
            for sy in range(samples):
                for sx in range(samples):
                    c = _colour_at((px + (sx + 0.5) / samples) * scale, (py + (sy + 0.5) / samples) * scale, corner)
                    if c:
                        r, g, b, a = r + c[0], g + c[1], b + c[2], a + 1
            n = samples * samples
            row += bytes([r // a, g // a, b // a, 255 * a // n] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    return _png(size, b"".join(rows))


def _png(size: int, raw: bytes) -> bytes:
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def _ico(pngs: dict[int, bytes]) -> bytes:
    """An .ico holding PNG images (supported by every browser since 2007)."""
    header = struct.pack("<HHH", 0, 1, len(pngs))
    entries, blobs, offset = b"", b"", 6 + 16 * len(pngs)
    for size, data in pngs.items():
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    return header + entries + blobs


def svg() -> str:
    paths = " ".join(
        "M" + " L".join(f"{x:g} {y:g}" for x, y in ((round(px, 2), round(py, 2)) for px, py in line)) for line in STROKES
    )
    hexc = lambda c: "#%02x%02x%02x" % c  # noqa: E731
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<rect width="64" height="64" rx="14" fill="{hexc(INK)}"/>'
        f'<path d="{paths}" fill="none" stroke="{hexc(PAPER)}" stroke-width="{STROKE:g}" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="{DOT[0][0]}" cy="{DOT[0][1]}" r="{DOT[1]}" fill="{hexc(EMBER)}"/>'
        "</svg>\n"
    )


def main() -> None:
    web, ext = ROOT / "web" / "app", ROOT / "extension" / "icons"
    (web / "icon.svg").write_text(svg(), encoding="utf-8")
    (web / "favicon.ico").write_bytes(_ico({s: render(s) for s in (16, 32, 48)}))
    (web / "apple-icon.png").write_bytes(render(180, corner=0))
    for s in (16, 32, 48, 128):
        (ext / f"icon{s}.png").write_bytes(render(s))
    print("wrote web/app/icon.svg, favicon.ico, apple-icon.png and extension/icons/*.png")


if __name__ == "__main__":
    main()
