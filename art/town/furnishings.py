"""
The rooms' furniture, and the park's benches, put together in code by `pieces.py`: upholstered seats with soft, rounded cushions, a made bed,
kitchen units with doors and handles, tables, chairs, rugs, lamps and a potted plant. Each keeps the size the kit piece
it replaces had, so the rooms' layouts (`src/world/town.ts`) stand as they were. Upholstery is `red` and rugs `red`
and `brick`, the colours the rooms repaint.

In Blender's frame: x across, -y the front (glTF's +z), z up, in metres, standing on the floor.
"""

import math
import random

import bmesh
from mathutils import Euler, Matrix, Vector

WOOD = "wood:wood"
DARK_WOOD = "walnut:wood"
CLOTH = "red:fabric"
LINEN = "white:fabric"
METAL = "slate:metal"
BRASS = "mustard:brass"


def soft_box(p, colour, size, at=(0, 0, 0), radius=0.04, rot=(0, 0, 0), segments=3):
    """A box with its edges rounded over `radius`: a cushion, a mattress, a table top."""
    matrix = Matrix.Translation(Vector(at)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
    before = set(p.bm.faces)
    made = bmesh.ops.create_cube(p.bm, size=1, matrix=matrix)
    verts = made["verts"]
    edges = list({edge for vert in verts for edge in vert.link_edges})
    radius = min(radius, min(size) / 2 - 1e-3)
    bmesh.ops.bevel(p.bm, geom=edges + verts, offset=radius, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    p._paint(set(p.bm.faces) - before, colour)


def leg(p, colour, at, height, top=0.025, foot=0.018, segments=8):
    """A turned leg, tapering to its foot."""
    p.cylinder(colour, top, height, at=(at[0], at[1], height / 2), top=foot, segments=segments, rot=(math.pi, 0, 0))


def legs(p, colour, w, d, height, inset=0.06, **kwargs):
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg(p, colour, (sx * (w / 2 - inset), sy * (d / 2 - inset)), height, **kwargs)


def upholstered(p, width, seats):
    """A sofa or armchair `width` wide, 0.94 m deep and 1.06 m high, with `seats` seat cushions and as many at its back."""
    depth, height, arm = 0.94, 1.06, 0.2
    legs(p, DARK_WOOD, width, depth, 0.12, inset=0.08, top=0.03, foot=0.022)
    soft_box(p, CLOTH, (width, depth, 0.3), at=(0, 0, 0.27), radius=0.03)
    # The back, and the arms either side.
    soft_box(p, CLOTH, (width, 0.2, height - 0.12), at=(0, depth / 2 - 0.1, 0.12 + (height - 0.12) / 2), radius=0.07)
    for side in (-1, 1):
        soft_box(p, CLOTH, (arm, depth, 0.38), at=(side * (width / 2 - arm / 2), 0, 0.42 + 0.19), radius=0.08)
    # Seat cushions, and back cushions leaning on the back.
    inner = width - 2 * arm
    each = inner / seats
    for k in range(seats):
        x = -inner / 2 + (k + 0.5) * each
        soft_box(p, CLOTH, (each - 0.02, depth - 0.24, 0.16), at=(x, -0.06, 0.5), radius=0.06)
        soft_box(p, CLOTH, (each - 0.03, 0.18, 0.42), at=(x, depth / 2 - 0.27, 0.8), rot=(-0.18, 0, 0), radius=0.07)


def sofa(p):
    """A three-seat sofa, 2.26 m long."""
    upholstered(p, 2.26, 3)


def armchair(p):
    """An armchair, 1.12 m wide."""
    upholstered(p, 1.12, 1)


def bed(p):
    """
    A single bed, 1.32 m by 2.58 m, its head at the back (+y): a wooden frame with a panelled headboard, a mattress, a
    duvet folded back at the top over a white sheet, and two pillows.
    """
    w, d = 1.32, 2.58
    legs(p, DARK_WOOD, w, d, 0.14, inset=0.06, top=0.035, foot=0.03)
    soft_box(p, WOOD, (w, d - 0.08, 0.2), at=(0, -0.04, 0.24), radius=0.015)
    # Headboard and footboard.
    soft_box(p, WOOD, (w, 0.06, 0.86), at=(0, d / 2 - 0.03, 0.43), radius=0.02)
    soft_box(p, DARK_WOOD, (w - 0.2, 0.08, 0.38), at=(0, d / 2 - 0.03, 0.6), radius=0.02)
    soft_box(p, WOOD, (w, 0.06, 0.5), at=(0, -d / 2 + 0.03, 0.25), radius=0.02)
    # Mattress, sheet, duvet with its fold, pillows.
    soft_box(p, LINEN, (w - 0.1, d - 0.2, 0.2), at=(0, 0, 0.44), radius=0.06)
    soft_box(p, CLOTH, (w - 0.04, d - 0.75, 0.1), at=(0, -0.26, 0.55), radius=0.05)
    soft_box(p, LINEN, (w - 0.05, 0.22, 0.11), at=(0, d / 2 - 0.84, 0.56), radius=0.05)
    for x in (-0.28, 0.28):
        soft_box(p, LINEN, (0.52, 0.34, 0.13), at=(x, d / 2 - 0.36, 0.6), rot=(0.12, 0, 0), radius=0.06)


def chair(p):
    """A dining chair, 0.46 m square and 1.06 m to the top of its back (at +y), with a cushion on its seat."""
    s = 0.46
    for sx in (-1, 1):
        leg(p, WOOD, (sx * (s / 2 - 0.035), -(s / 2 - 0.035)), 0.45, top=0.022, foot=0.016)
        p.cylinder(WOOD, 0.02, 1.06, at=(sx * (s / 2 - 0.035), s / 2 - 0.035, 0.53), top=0.022, segments=8)
    soft_box(p, WOOD, (s, s, 0.045), at=(0, 0, 0.47), radius=0.012)
    soft_box(p, CLOTH, (s - 0.06, s - 0.08, 0.05), at=(0, -0.02, 0.515), radius=0.025)
    soft_box(p, WOOD, (s - 0.04, 0.03, 0.09), at=(0, s / 2 - 0.035, 0.98), radius=0.012)
    for x in (-0.11, 0, 0.11):
        p.box(WOOD, (0.035, 0.02, 0.36), at=(x, s / 2 - 0.035, 0.75))


def table_top(p, w, d, height, thickness=0.045, colour=WOOD):
    """A table: a top with rounded edges on an apron, and four legs."""
    soft_box(p, colour, (w, d, thickness), at=(0, 0, height - thickness / 2), radius=0.015)
    soft_box(p, colour, (w - 0.14, d - 0.14, 0.08), at=(0, 0, height - thickness - 0.04), radius=0.01)
    legs(p, colour, w - 0.06, d - 0.06, height - thickness, inset=0.05, top=0.03, foot=0.022)


def table_plain(p):
    """A plain wooden table, 1.94 m by 1.02 m and 0.75 m high."""
    table_top(p, 1.94, 1.02, 0.75)


def table(p):
    """A table laid with a cloth runner down its length, 1.96 m by 1.02 m and 0.8 m high: the cloth is `red`, repainted."""
    table_top(p, 1.96, 1.02, 0.78)
    soft_box(p, CLOTH, (1.96, 0.56, 0.012), at=(0, 0, 0.786), radius=0.005)
    for side in (-1, 1):
        p.box(CLOTH, (0.012, 0.56, 0.2), at=(side * 0.986, 0, 0.69))


def table_round(p):
    """A round café table, 1.6 m across and 0.84 m high, on a single pedestal."""
    p.cylinder(WOOD, 0.8, 0.045, at=(0, 0, 0.817), segments=32)
    p.cylinder(DARK_WOOD, 0.74, 0.03, at=(0, 0, 0.78), segments=32)
    p.cylinder(DARK_WOOD, 0.07, 0.72, at=(0, 0, 0.42), top=0.05, segments=12)
    for k in range(4):
        angle = k * math.pi / 2 + math.pi / 4
        p.rod(DARK_WOOD, (0, 0, 0.1), (0.42 * math.cos(angle), 0.42 * math.sin(angle), 0.02), 0.035, segments=6)


def coffee_table(p):
    """A low table, 1.52 m by 0.92 m and 0.53 m high, with a shelf under it."""
    table_top(p, 1.52, 0.92, 0.53, thickness=0.05)
    soft_box(p, WOOD, (1.36, 0.76, 0.03), at=(0, 0, 0.14), radius=0.01)


def kitchen_unit(p, height=1.03, top="stone:stone", doors=2):
    """A kitchen base unit, 0.98 m wide and 1.04 m deep: panelled doors with brass handles under a stone worktop."""
    w, d = 0.98, 1.04
    body = height - 0.04
    p.box("ink:paint", (w - 0.04, d - 0.1, 0.1), at=(0, 0.02, 0.05))
    p.box(WOOD, (w, d - 0.04, body - 0.1), at=(0, 0.02, 0.1 + (body - 0.1) / 2))
    soft_box(p, top, (w, d, 0.04), at=(0, 0, body + 0.02), radius=0.008)
    each = (w - 0.02) / doors
    for k in range(doors):
        x = -w / 2 + 0.01 + (k + 0.5) * each
        soft_box(p, DARK_WOOD, (each - 0.02, 0.025, body - 0.16), at=(x, -d / 2 + 0.0125, 0.12 + (body - 0.16) / 2), radius=0.006)
        soft_box(p, WOOD, (each - 0.12, 0.02, body - 0.32), at=(x, -d / 2 - 0.005, 0.12 + (body - 0.16) / 2), radius=0.006)
        hx = x + (0.5 - k) * (each / 2 - 0.06) if doors > 1 else x + each / 2 - 0.08
        p.cylinder(BRASS, 0.01, 0.14, at=(hx, -d / 2 - 0.035, body - 0.16), segments=6)
        for z in (body - 0.09, body - 0.23):
            p.box(BRASS, (0.012, 0.03, 0.012), at=(hx, -d / 2 - 0.018, z))


def counter(p):
    """A kitchen or shop counter unit, 0.98 m wide, 1.04 m deep and 1.03 m high: stretched and repeated along a counter."""
    kitchen_unit(p)


def sink(p):
    """A kitchen unit with a steel sink let into its worktop and a swan-neck tap, 1.13 m to the top of the tap."""
    kitchen_unit(p)
    p.box(METAL, (0.6, 0.48, 0.012), at=(0, -0.05, 1.035))
    p.box("charcoal:metal", (0.52, 0.4, 0.012), at=(0, -0.05, 1.037))
    p.cylinder(METAL, 0.02, 0.1, at=(0, 0.26, 1.08), segments=8)
    p.rod(METAL, (0, 0.26, 1.12), (0, 0.12, 1.12), 0.015, segments=6)
    p.rod(METAL, (0, 0.12, 1.12), (0, 0.08, 1.05), 0.015, segments=6)


def stove(p):
    """A cooker, 0.98 m wide: an oven with a glass door under a black hob with four rings and its knobs along the front."""
    w, d, h = 0.98, 1.04, 1.03
    p.box("ink:paint", (w - 0.04, d - 0.1, 0.1), at=(0, 0.02, 0.05))
    p.box("white:ceramic", (w, d - 0.04, h - 0.14), at=(0, 0.02, 0.1 + (h - 0.14) / 2))
    soft_box(p, "ink:metal", (w, d, 0.04), at=(0, 0, h - 0.02), radius=0.008)
    for x in (-0.22, 0.22):
        for y in (-0.2, 0.22):
            p.cylinder("charcoal:metal", 0.11, 0.012, at=(x, y, h + 0.006), segments=16)
            p.torus("slate:metal", 0.07, 0.008, at=(x, y, h + 0.014), segments=12, sides=4)
    soft_box(p, "ink:paint", (w - 0.16, 0.02, 0.48), at=(0, -d / 2 + 0.01, 0.42), radius=0.01)
    p.box("slate:metal", (w - 0.24, 0.03, 0.025), at=(0, -d / 2 - 0.03, 0.72))
    for k in range(5):
        p.cylinder("slate:metal", 0.022, 0.04, at=(-0.32 + k * 0.16, -d / 2 - 0.02, 0.86), rot=(math.pi / 2, 0, 0), segments=10)


def fridge(p):
    """A fridge-freezer, 0.98 m wide, 0.68 m deep and 2.12 m tall, in white enamel with long steel handles."""
    w, d, h = 0.98, 0.68, 2.12
    soft_box(p, "white:ceramic", (w, d - 0.04, h), at=(0, 0.02, h / 2), radius=0.03)
    soft_box(p, "white:ceramic", (w - 0.01, 0.04, h * 0.62 - 0.01), at=(0, -d / 2 + 0.02, h * 0.31), radius=0.015)
    soft_box(p, "white:ceramic", (w - 0.01, 0.04, h * 0.38 - 0.02), at=(0, -d / 2 + 0.02, h * 0.62 + h * 0.19), radius=0.015)
    for z0, z1 in ((h * 0.38, h * 0.58), (h * 0.66, h * 0.86)):
        p.rod(METAL, (w / 2 - 0.08, -d / 2 - 0.04, z0), (w / 2 - 0.08, -d / 2 - 0.04, z1), 0.012, segments=6)
        for z in (z0, z1):
            p.box(METAL, (0.02, 0.04, 0.02), at=(w / 2 - 0.08, -d / 2 - 0.02, z))


def wall_cabinet(p):
    """A kitchen wall cupboard, 0.98 m wide, 0.5 m deep and 0.9 m tall, with two doors."""
    w, d, h = 0.98, 0.5, 0.9
    p.box(WOOD, (w, d - 0.03, h), at=(0, 0.015, h / 2))
    for k, x in enumerate((-w / 4, w / 4)):
        soft_box(p, DARK_WOOD, (w / 2 - 0.02, 0.025, h - 0.04), at=(x, -d / 2 + 0.0125, h / 2), radius=0.006)
        soft_box(p, WOOD, (w / 2 - 0.12, 0.02, h - 0.18), at=(x, -d / 2 - 0.005, h / 2), radius=0.006)
        hx = x + (0.5 - k) * (w / 4 - 0.06)
        p.cylinder(BRASS, 0.01, 0.12, at=(hx, -d / 2 - 0.035, 0.18), segments=6)


def rug(p):
    """A rectangular rug, 3.62 m by 2.12 m: a `red` ground with a `brick` field, a cream band round it and fringed ends."""
    w, d = 3.62, 2.12
    p.box(CLOTH, (w - 0.1, d, 0.012), at=(0, 0, 0.006))
    p.box("cream:fabric", (w - 0.4, d - 0.3, 0.004), at=(0, 0, 0.013))
    p.box("brick:fabric", (w - 0.56, d - 0.46, 0.004), at=(0, 0, 0.016))
    p.box(CLOTH, (w - 1.4, d - 1.1, 0.003), at=(0, 0, 0.019))
    for side in (-1, 1):
        for k in range(24):
            y = -d / 2 + (k + 0.5) * d / 24
            p.box("cream:fabric", (0.05, 0.012, 0.004), at=(side * (w / 2 - 0.025), y, 0.004))


def rug_round(p):
    """A round rug, 2.12 m across: a `red` ground with a `brick` ring and a cream ring in it."""
    p.cylinder(CLOTH, 1.06, 0.012, at=(0, 0, 0.006), segments=40)
    p.cylinder("cream:fabric", 0.9, 0.004, at=(0, 0, 0.013), segments=40)
    p.cylinder("brick:fabric", 0.82, 0.004, at=(0, 0, 0.016), segments=40)
    p.cylinder(CLOTH, 0.5, 0.003, at=(0, 0, 0.019), segments=32)


def plant(p):
    """A potted fig, 1.5 m tall: a terracotta pot and broad leaves on arching stems."""
    rng = random.Random(7)
    p.cylinder("terracotta:ceramic", 0.22, 0.42, at=(0, 0, 0.21), top=0.24, segments=16)
    p.cylinder("terracotta:ceramic", 0.255, 0.05, at=(0, 0, 0.42), segments=16)
    p.cylinder("walnut:matte", 0.22, 0.02, at=(0, 0, 0.43), segments=16)
    p.cylinder(DARK_WOOD, 0.02, 0.7, at=(0, 0, 0.78), segments=6)
    for k in range(16):
        angle = k * 2.4 + rng.random() * 0.3
        rise = 0.6 + 0.85 * (k / 16) + rng.random() * 0.1
        reach = 0.12 + 0.12 * rng.random()
        base = Vector((0, 0, min(rise - 0.1, 1.1)))
        tip = Vector((reach * math.cos(angle), reach * math.sin(angle) * 1.15, rise))
        p.rod(DARK_WOOD, base, tip, 0.006, segments=4)
        p.ball("leaf:foliage", 0.11, at=tuple(tip + Vector((0.06 * math.cos(angle), 0.06 * math.sin(angle), 0.02))), scale=(1.0, 0.55, 0.18), subdivisions=2)
        p.bm.verts.ensure_lookup_table()
        rotation = Matrix.Rotation(angle, 4, "Z") @ Matrix.Rotation(-0.5, 4, "Y")
        centre = tip + Vector((0.06 * math.cos(angle), 0.06 * math.sin(angle), 0.02))
        made = p.bm.verts[-42:]
        for vert in made:
            vert.co = centre + (rotation @ (vert.co - centre))


def floor_lamp(p):
    """A standard lamp, 1.98 m tall: a brass stem on a heavy base under a pleated cream shade, its bulb inside."""
    p.cylinder("ink:metal", 0.16, 0.04, at=(0, 0, 0.02), segments=20)
    p.cylinder(BRASS, 0.016, 1.6, at=(0, 0, 0.84), segments=8)
    p.ball("lamplight", 0.06, at=(0, 0, 1.6), subdivisions=2)
    p.cylinder("cream:fabric", 0.17, 0.36, at=(0, 0, 1.75), top=0.11, segments=18)
    p.cylinder(BRASS, 0.005, 0.06, at=(0, 0, 1.95), segments=4)


def table_lamp(p):
    """A bedside lamp, 0.67 m tall: a glazed round base under a cream drum shade."""
    p.cylinder("teal:ceramic", 0.06, 0.04, at=(0, 0, 0.02), segments=16)
    p.ball("teal:ceramic", 0.1, at=(0, 0, 0.16), scale=(1, 1, 1.15), subdivisions=2)
    p.cylinder(BRASS, 0.01, 0.2, at=(0, 0, 0.36), segments=6)
    p.ball("lamplight", 0.04, at=(0, 0, 0.45), subdivisions=2)
    p.cylinder("cream:fabric", 0.14, 0.24, at=(0, 0, 0.55), top=0.11, segments=18)


def bench(p):
    """
    A park bench, 0.92 m long (the town stretches it), 0.46 m deep and 1.08 m to the top of its back (at +y): wooden
    slats on cast-iron ends with scrolled arms.
    """
    w, d = 0.92, 0.46
    iron = "ink:metal"
    for side in (-1, 1):
        x = side * (w / 2 - 0.03)
        p.rod(iron, (x, -d / 2 + 0.03, 0), (x, -d / 2 + 0.05, 0.44), 0.02, segments=6)
        p.rod(iron, (x, d / 2 - 0.05, 0), (x, d / 2 - 0.03, 0.44), 0.02, segments=6)
        p.rod(iron, (x, d / 2 - 0.03, 0.44), (x, d / 2, 1.06), 0.02, segments=6)
        p.rod(iron, (x, -d / 2 + 0.05, 0.42), (x, d / 2 - 0.03, 0.42), 0.018, segments=6)
        p.rod(iron, (x, -d / 2 + 0.04, 0.44), (x, -d / 2 + 0.06, 0.66), 0.016, segments=6)
        p.rod(iron, (x, -d / 2 + 0.06, 0.66), (x, d / 2 - 0.02, 0.7), 0.018, segments=6)
        p.ball(iron, 0.03, at=(x, -d / 2 + 0.06, 0.66), subdivisions=2)
    for k in range(4):
        y = -d / 2 + 0.06 + k * (d - 0.1) / 4
        soft_box(p, WOOD, (w, 0.085, 0.03), at=(0, y, 0.455), radius=0.008)
    for k in range(3):
        z = 0.62 + k * 0.15
        t = (z - 0.44) / (1.06 - 0.44)
        soft_box(p, WOOD, (w, 0.03, 0.09), at=(0, d / 2 - 0.03 + 0.03 * t, z), rot=(-0.05, 0, 0), radius=0.008)


PIECES = {
    "bench": bench,
    "sofa": sofa,
    "armchair": armchair,
    "bed": bed,
    "chair": chair,
    "table": table,
    "table-plain": table_plain,
    "table-round": table_round,
    "coffee-table": coffee_table,
    "counter": counter,
    "sink": sink,
    "stove": stove,
    "fridge": fridge,
    "wall-cabinet": wall_cabinet,
    "rug": rug,
    "rug-round": rug_round,
    "plant": plant,
    "floor-lamp": floor_lamp,
    "table-lamp": table_lamp,
}
