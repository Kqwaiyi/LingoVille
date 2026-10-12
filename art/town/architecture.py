"""
The town's buildings, piece by piece: walls, windows, doorways, doors, floors, roofs, the band between storeys, chimneys
and the street lights. Each is put together in code by `pieces.py`, which builds and exports them all.

Materials are named `colour:surface`: a palette colour (`src/world/palette.ts`) and how it's made (`SURFACES` in
`src/world/surfaces.ts`), so a wall's plaster and its stone sill can both be repainted per building but stay plaster and
stone. Walls come in lavender and roofs in charcoal, the colours each building repaints with its own.

In Blender's frame: x along the piece, -y out of its front (glTF's +z), z up, in metres.
"""

import math

# The town's walls: a storey's height and the walls' thickness (`WALL` in `src/world/town.ts`).
STOREY = 2.4
T = 0.3
# How far the stone and the trim stand proud of the wall, outside and in. Each piece reaches as far in as it does out,
# so standing it on its footprint's middle keeps the wall's middle where the town puts it.
PROUD = 0.07

FACADE = "lavender:plaster"
PLASTER = "linen:plaster"
STONE = "stone:stone"
TRIM = "white:paint"
ROOF = "charcoal:tile"


def wall_slab(p, x0, x1, z0, z1, outside=FACADE, inside=PLASTER):
    """A stretch of wall: its outer half in the façade, its inner half in plaster, with a plaster top."""
    w, h = x1 - x0, z1 - z0
    if w <= 1e-4 or h <= 1e-4:
        return
    top = min(z1, STOREY - 0.01)
    if top > z0:
        p.box(outside, (w, T / 2, top - z0), at=((x0 + x1) / 2, -T / 4, (z0 + top) / 2))
        p.box(inside, (w, T / 2, top - z0), at=((x0 + x1) / 2, T / 4, (z0 + top) / 2))
    if z1 > top:
        p.box(inside, (w, T, z1 - top), at=((x0 + x1) / 2, 0, (top + z1) / 2))


def plinth(p, x0, x1):
    """The stone course along the foot of a wall outside, with a weathered top."""
    out = -T / 2
    profile = [(out, 0.0), (out - 0.045, 0.0), (out - 0.045, 0.3), (out - 0.02, 0.34), (out, 0.34)]
    p.prism(STONE, profile, x1 - x0, axis="x", offset=(x0 + x1) / 2)


def skirting(p, x0, x1):
    """The skirting board along the foot of a wall inside."""
    p.box(TRIM, (x1 - x0, 0.022, 0.13), at=((x0 + x1) / 2, T / 2 + 0.011, 0.065))
    p.box(TRIM, (x1 - x0, 0.03, 0.015), at=((x0 + x1) / 2, T / 2 + 0.015, 0.1375))


def wall(p):
    """A plain stretch of wall, 2 m long and a storey high: plaster outside on a stone plinth, a skirting board inside."""
    wall_slab(p, -1, 1, 0, STOREY)
    plinth(p, -1, 1)
    skirting(p, -1, 1)
    # Reaches in as far as a window's sill reaches out, so it stands on its middle as the windows do.
    p.box(TRIM, (0.02, 0.01, 0.01), at=(0, T / 2 + PROUD - 0.005, 0.005))
    p.box(STONE, (0.02, 0.01, 0.01), at=(0, -T / 2 - PROUD + 0.005, 0.005))


def window(p, half, z0, z1, mullion=True):
    """
    A window in an opening `2 * half` wide from `z0` to `z1`: a painted casement set back in the wall, with a mullion and a
    transom, a stone surround with a keystone over it and a sill under it outside, and a window board and trim inside.
    """
    out, inn = -T / 2, T / 2
    h = z1 - z0
    mid = (z0 + z1) / 2
    # The glass, the whole opening, behind the frame.
    p.box("glass", (2 * half, 0.012, h), at=(0, -0.035, mid))
    # The frame round it and the bars across it, set back from the face of the wall.
    f, depth, y = 0.065, 0.07, -0.045
    p.box(TRIM, (2 * half, depth, f), at=(0, y, z0 + f / 2))
    p.box(TRIM, (2 * half, depth, f), at=(0, y, z1 - f / 2))
    p.box(TRIM, (f, depth, h), at=(-half + f / 2, y, mid))
    p.box(TRIM, (f, depth, h), at=(half - f / 2, y, mid))
    transom = z1 - h * 0.28
    p.box(TRIM, (2 * half, depth * 0.8, 0.05), at=(0, y, transom))
    if mullion:
        p.box(TRIM, (0.05, depth * 0.8, transom - z0), at=(0, y, (z0 + transom) / 2))
    # Each casement's own sash, a little proud of the frame.
    for side in ((-1, 1) if mullion else (0,)):
        x0, x1 = (side * half, 0) if side else (-half, half)
        sx0, sx1 = min(x0, x1), max(x0, x1)
        w = sx1 - sx0
        p.box(TRIM, (w - 0.02, 0.02, 0.04), at=((sx0 + sx1) / 2, y - 0.04, z0 + f + 0.02))
    # Outside: the stone surround, the lintel with its keystone, and the sill.
    s = 0.1
    p.box(STONE, (s, 0.028, h + s), at=(-half - s / 2, out - 0.014, mid - s / 2))
    p.box(STONE, (s, 0.028, h + s), at=(half + s / 2, out - 0.014, mid - s / 2))
    p.box(STONE, (2 * half + 2 * s + 0.12, 0.04, 0.17), at=(0, out - 0.02, z1 + 0.085))
    p.prism(STONE, [(-0.075, z1 - 0.03), (0.075, z1 - 0.03), (0.095, z1 + 0.22), (-0.095, z1 + 0.22)], 0.07, axis="y", offset=out - 0.035)
    sill = 2 * half + 2 * s + 0.1
    p.prism(STONE, [(out - PROUD, z0 - 0.07), (out + 0.1, z0 - 0.07), (out + 0.1, z0), (out - 0.02, z0), (out - PROUD, z0 - 0.02)], sill, axis="x")
    # Inside: the window board and the trim round the opening.
    p.box(TRIM, (2 * half + 0.16, PROUD + 0.09, 0.03), at=(0, inn + PROUD / 2 - 0.045, z0 - 0.015))
    for x in (-half - 0.035, half + 0.035):
        p.box(TRIM, (0.07, 0.018, h + 0.07), at=(x, inn + 0.009, mid + 0.035 - 0.03))
    p.box(TRIM, (2 * half + 0.14, 0.018, 0.07), at=(0, inn + 0.009, z1 + 0.035))


def wall_window(p):
    """A stretch of wall with a window in its middle: 0.9 m wide, from 0.7 m to 1.9 m up."""
    half, z0, z1 = 0.45, 0.7, 1.9
    wall_slab(p, -1, -half, 0, STOREY)
    wall_slab(p, half, 1, 0, STOREY)
    wall_slab(p, -half, half, 0, z0)
    wall_slab(p, -half, half, z1, STOREY)
    plinth(p, -1, 1)
    skirting(p, -1, 1)
    window(p, half, z0, z1)


def wall_doorway(p):
    """
    The front door's wall: a doorway 1.8 m wide and 2.12 m high, framed outside by stone pilasters under a corniced
    lintel, with a stone threshold through it.
    """
    w, half, top = 1.24, 0.9, 2.12
    out, inn = -T / 2, T / 2
    wall_slab(p, -w, -half, 0, STOREY)
    wall_slab(p, half, w, 0, STOREY)
    wall_slab(p, -half, half, top, STOREY)
    for side in (-1, 1):
        x0, x1 = sorted((side * half, side * w))
        plinth(p, x0, x1)
        skirting(p, x0, x1)
        # A pilaster either side, on a plinth of its own, with a capital.
        px = side * (half + 0.08)
        p.box(STONE, (0.16, 0.035, top), at=(px, out - 0.0175, top / 2))
        p.box(STONE, (0.2, 0.05, 0.36), at=(px, out - 0.025, 0.18))
        p.box(STONE, (0.21, 0.05, 0.06), at=(px, out - 0.025, top - 0.03))
        # The trim round the doorway inside.
        p.box(TRIM, (0.08, 0.018, top + 0.08), at=(side * (half + 0.04), inn + 0.009, (top + 0.08) / 2))
    # The lintel over the pilasters, under a cornice.
    p.box(STONE, (2 * half + 0.36, 0.045, 0.2), at=(0, out - 0.0225, top + 0.1))
    p.prism(STONE, [(out, top + 0.2), (out - 0.05, top + 0.2), (out - PROUD, top + 0.25), (out - PROUD, top + 0.28), (out, top + 0.28)], 2 * half + 0.44, axis="x")
    p.box(TRIM, (2 * half + 0.16, 0.018, 0.08), at=(0, inn + 0.009, top + 0.04))
    # The threshold, through the wall and a step's worth either side.
    p.box(STONE, (2 * half, T + 2 * PROUD, 0.03), at=(0, 0, 0.015))


def door(p):
    """
    One leaf of a front door, 0.9 m by 2.1 m: a varnished panelled door, glazed above, with a brass knob near its +x edge.
    The same both sides, so a pair is one leaf and the other turned round.
    """
    w, h, t = 0.9, 2.1, 0.05
    wood, panel = "walnut:wood", "wood:wood"
    stile, rail = 0.11, 0.12
    # The stiles and rails, the glass in the top half and two raised panels below.
    p.box(wood, (stile, t, h), at=(-w / 2 + stile / 2, 0, h / 2))
    p.box(wood, (stile, t, h), at=(w / 2 - stile / 2, 0, h / 2))
    for z, height in ((0.11, 0.22), (1.0, 0.16), (h - rail / 2, rail)):
        p.box(wood, (w - 2 * stile, t, height), at=(0, 0, z))
    inner = w - 2 * stile
    p.box("glass", (inner, 0.012, h - rail - 1.08), at=(0, 0, (1.08 + h - rail) / 2))
    p.box(wood, (0.035, t * 0.7, h - rail - 1.08), at=(0, 0, (1.08 + h - rail) / 2))
    p.box(wood, (inner, t * 0.7, 0.035), at=(0, 0, (1.08 + h - rail) / 2))
    for x in (-inner / 4, inner / 4):
        p.box(wood, (inner / 2 - 0.02, t * 0.8, 0.86), at=(x, 0, 0.22 + 0.43))
        p.box(panel, (inner / 2 - 0.12, t + 0.024, 0.72), at=(x, 0, 0.22 + 0.43))
    # The knob, both sides, and a letter plate.
    for side in (-1, 1):
        p.cylinder("mustard:brass", 0.012, 0.03, at=(w / 2 - 0.075, side * (t / 2 + 0.015), 1.0), rot=(math.pi / 2, 0, 0), segments=8)
        p.ball("mustard:brass", 0.03, at=(w / 2 - 0.075, side * (t / 2 + 0.04), 1.0), subdivisions=2)
    p.box("mustard:brass", (0.26, 0.006, 0.06), at=(0, -t / 2 - 0.003, 0.95))


def floor(p):
    """A room's floor, 2 m square: honey-coloured oak boards. The town stretches it to each room."""
    p.box("wood:planks", (2.0, 2.0, 0.1), at=(0, 0, 0.05))


# The roofs: one typical building's, 9 m deep, which the town stretches to each building's own.
ROOF_DEPTH, ROOF_HEIGHT = 9.4, 2.52
EAVE = ROOF_DEPTH / 2 - 0.08


def roof_courses(p, x0, x1, side):
    """One slope of a tiled roof, from the eave on `side` (+1 or -1) up to the ridge: rows of tiles, each overlapping the next."""
    courses, butt, thickness = 13, 0.035, 0.16
    eave, ridge = (EAVE, 0.16), (0.0, ROOF_HEIGHT - 0.14)
    top = []
    for i in range(courses):
        t0, t1 = i / courses, (i + 1) / courses
        y0, z0 = eave[0] + (ridge[0] - eave[0]) * t0, eave[1] + (ridge[1] - eave[1]) * t0
        y1, z1 = eave[0] + (ridge[0] - eave[0]) * t1, eave[1] + (ridge[1] - eave[1]) * t1
        top += [(y0, z0 - (butt if i == 0 else 0)), (y0, z0 + butt), (y1, z1)]
    under = [(ridge[0], ridge[1] - thickness), (eave[0], eave[1] - thickness)]
    outline = [(side * y, z) for y, z in top + under]
    p.prism(ROOF, outline, x1 - x0, axis="x", offset=(x0 + x1) / 2)


def roof_eaves(p, x0, x1):
    """The fascia boards along both eaves, the gutters on them, and the ridge's capping tiles."""
    length, middle = x1 - x0, (x0 + x1) / 2
    for side in (-1, 1):
        p.box(TRIM, (length, 0.035, 0.2), at=(middle, side * (EAVE + 0.0175), 0.1))
        p.cylinder("slate:metal", 0.055, length, at=(middle, side * (EAVE + 0.09), 0.17), rot=(0, math.pi / 2, 0), segments=10)
    p.cylinder(ROOF, 0.1, length, at=(middle, 0, ROOF_HEIGHT - 0.1), rot=(0, math.pi / 2, 0), segments=10)


def attic(p, x0, x1):
    """The wall under the roof, filling its triangle: the gable's, in the façade."""
    wall_half = ROOF_DEPTH / 2 - 0.2
    p.prism(FACADE, [(-wall_half, 0.0), (wall_half, 0.0), (0.0, ROOF_HEIGHT - 0.2)], x1 - x0, axis="x", offset=(x0 + x1) / 2)


def roof_gable(p):
    """The middle of a gable roof, 1 m along its ridge, which the town stretches: tiled slopes, fascias, gutters and ridge."""
    attic(p, -0.5, 0.5)
    for side in (-1, 1):
        roof_courses(p, -0.5, 0.5, side)
    roof_eaves(p, -0.5, 0.5)


def roof_gable_end(p):
    """
    A gable roof's end, 0.6 m along, its outer end at +x: the gable wall under it (flush with the side wall, 0.2 m in from
    the roof's edge), with a round louvred vent, and painted barge boards along the verges.
    """
    x0, x1, wall_face = -0.3, 0.3, 0.1
    attic(p, x0, wall_face)
    for side in (-1, 1):
        roof_courses(p, x0, x1, side)
    roof_eaves(p, x0, x1)
    # The barge boards, under the tiles' edge.
    eave, ridge = (EAVE, 0.16), (0.0, ROOF_HEIGHT - 0.14)
    for side in (-1, 1):
        board = [(side * eave[0], 0.0), (side * eave[0], eave[1] - 0.04), (ridge[0], ridge[1] - 0.04), (ridge[0], ridge[1] - 0.2)]
        p.prism(TRIM, board, 0.04, axis="x", offset=x1 - 0.02)
    # The vent, high in the gable.
    vent = ROOF_HEIGHT * 0.42
    p.cylinder(TRIM, 0.3, 0.05, at=(wall_face + 0.025, 0, vent), rot=(0, math.pi / 2, 0), segments=20)
    p.cylinder("charcoal:paint", 0.23, 0.06, at=(wall_face + 0.026, 0, vent), rot=(0, math.pi / 2, 0), segments=20)
    for k in range(-2, 3):
        p.box(TRIM, (0.03, 0.42 - 0.08 * abs(k), 0.03), at=(wall_face + 0.06, 0, vent + k * 0.085), rot=(0.0, -0.5, 0.0))


def roof_flat(p):
    """A flat roof, 2 m square, which the town stretches: a membrane of dark felt with a gravel finish."""
    p.box("charcoal:roofing", (2.0, 2.0, 0.1), at=(0, 0, 0.05))


def roof_edge(p):
    """
    A parapet, 2 m long and 0.3 m high, the same both sides: plaster between a moulded base and a stone coping. Squashed,
    it's the band between storeys.
    """
    p.box(FACADE, (2.0, 0.16, 0.3), at=(0, 0, 0.15))
    for side in (-1, 1):
        p.prism(FACADE, [(side * 0.08, 0.0), (side * 0.1, 0.0), (side * 0.1, 0.05), (side * 0.08, 0.09)], 2.0, axis="x")
    p.prism(STONE, [(-0.1, 0.25), (0.1, 0.25), (0.1, 0.3), (-0.1, 0.3)], 2.0, axis="x")
    p.prism(STONE, [(-0.08, 0.22), (0.08, 0.22), (0.1, 0.25), (-0.1, 0.25)], 2.0, axis="x")


def chimney(p):
    """A brick chimney stack with a corbelled stone cap and two clay pots, 1.8 m tall."""
    p.box("brick:brick", (0.38, 0.62, 1.45), at=(0, 0, 0.725))
    p.box("brick:brick", (0.44, 0.68, 0.08), at=(0, 0, 1.31))
    p.box(STONE, (0.48, 0.72, 0.1), at=(0, 0, 1.5))
    for y in (-0.15, 0.15):
        p.cylinder("terracotta:ceramic", 0.075, 0.24, at=(0, y, 1.67), top=0.06, segments=10)
        p.cylinder("terracotta:ceramic", 0.085, 0.04, at=(0, y, 1.78), segments=10)


def street_light(p):
    """
    A cast-iron street lamp, 3.6 m tall: a fluted post on a wide base, its swan-neck arm reaching 1.1 m out (towards -y,
    the piece's back) to a lantern of frosted glass. The pole stands 0.58 m from the piece's middle.
    """
    iron = "ink:metal"
    pole, lantern, top = -0.58, 0.5, 3.15
    p.cylinder(iron, 0.13, 0.18, at=(0, pole, 0.09), segments=12)
    p.cylinder(iron, 0.1, 0.5, at=(0, pole, 0.43), top=0.07, segments=12)
    p.torus(iron, 0.075, 0.02, at=(0, pole, 0.7), segments=12, sides=6)
    p.cylinder(iron, 0.055, top - 0.7, at=(0, pole, (top + 0.7) / 2), top=0.045, segments=10)
    p.torus(iron, 0.05, 0.016, at=(0, pole, 2.4), segments=12, sides=6)
    p.ball(iron, 0.07, at=(0, pole, top + 0.02), subdivisions=2)
    p.cylinder(iron, 0.02, 0.18, at=(0, pole, top + 0.15), top=0.0, segments=8)
    # The swan neck: up and over in a curve to hang the lantern.
    steps = 14
    points = []
    for i in range(steps + 1):
        t = i / steps
        angle = math.pi * t
        points.append((0, pole + (lantern - pole) * (0.5 - 0.5 * math.cos(angle)), top - 0.15 + 0.35 * math.sin(angle) - 0.05 * t))
    for a, b in zip(points, points[1:]):
        p.rod(iron, a, b, 0.024, segments=6)
    # A brace from the post up under the arm.
    p.rod(iron, (0, pole, top - 0.55), points[5], 0.014, segments=5)
    # The lantern: a cap, a frosted glass body that lights, a frame round it, and a finial below.
    hang = points[-1][2] - 0.06
    p.cylinder(iron, 0.03, 0.08, at=(0, lantern, hang + 0.02), segments=8)
    p.cylinder(iron, 0.2, 0.14, at=(0, lantern, hang - 0.08), top=0.04, segments=6)
    p.cylinder(iron, 0.19, 0.03, at=(0, lantern, hang - 0.16), segments=6)
    p.cylinder("white", 0.17, 0.34, at=(0, lantern, hang - 0.34), top=0.13, segments=6)
    for k in range(6):
        angle = k * math.pi / 3
        a = (0.175 * math.cos(angle), lantern + 0.175 * math.sin(angle), hang - 0.17)
        b = (0.135 * math.cos(angle), lantern + 0.135 * math.sin(angle), hang - 0.51)
        p.rod(iron, a, b, 0.01, segments=4)
    p.cylinder(iron, 0.14, 0.04, at=(0, lantern, hang - 0.53), segments=6)
    p.cylinder(iron, 0.05, 0.1, at=(0, lantern, hang - 0.6), top=0.0, segments=6)


def quoin(p):
    """
    The dressed stones up one storey of a building's corner, long and short by turns, standing just proud of both faces.
    Its corner is the wall's outer corner, the front face to -y and the side face to +x; the stones run back along each.
    """
    courses, height, proud = 8, STOREY / 8, 0.025
    for k in range(courses):
        z0, z1 = k * height + 0.012, (k + 1) * height - 0.012
        front, side = (0.42, 0.24) if k % 2 == 0 else (0.24, 0.42)
        p.box(STONE, (front + proud, proud, z1 - z0), at=(-(front - proud) / 2, -proud / 2, (z0 + z1) / 2))
        p.box(STONE, (proud, side, z1 - z0), at=(proud / 2, side / 2, (z0 + z1) / 2))


def downpipe(p):
    """A cast-iron rainwater pipe a storey long, with collars holding it to the wall and a shoe flaring at its foot."""
    iron = "charcoal:metal"
    p.cylinder(iron, 0.04, STOREY, at=(0, 0, STOREY / 2), segments=10)
    for z in (0.5, STOREY - 0.4):
        p.cylinder(iron, 0.052, 0.07, at=(0, 0, z), segments=10)
    p.cylinder(iron, 0.06, 0.1, at=(0, 0, 0.05), top=0.042, segments=10)


def shelter_post(p):
    """A tram shelter's post, 2.4 m tall: a fluted iron column, painted, on a dark base, with a capital at its top."""
    p.cylinder("charcoal:metal", 0.08, 0.3, at=(0, 0, 0.15), top=0.06, segments=12)
    p.cylinder("white:paint", 0.045, 2.0, at=(0, 0, 1.3), top=0.038, segments=12)
    for z in (0.32, 1.2):
        p.torus("white:paint", 0.048, 0.012, at=(0, 0, z), segments=12, sides=5)
    p.cylinder("white:paint", 0.04, 0.12, at=(0, 0, 2.34), top=0.08, segments=12)


def shelter_roof(p):
    """
    A tram shelter's canopy, 2.8 m by 1.6 m and 0.2 m deep: a gently curved metal roof (charcoal, which each stop
    repaints in its line's colour) over a painted fascia, with a lamp strip under its front edge.
    """
    w, d, rise, steps = 2.8, 1.6, 0.12, 10
    outline = []
    for k in range(steps + 1):
        y = -d / 2 + d * k / steps
        outline.append((y, 0.08 + rise * (1 - (2 * y / d) ** 2)))
    under = [(y, z - 0.035) for y, z in reversed(outline)]
    p.prism("charcoal:metal", outline + under, w, axis="x")
    for side in (-1, 1):
        p.box(TRIM, (w, 0.03, 0.09), at=(0, side * (d / 2 - 0.015), 0.07))
    for side in (-1, 1):
        p.box(TRIM, (0.03, d, 0.09), at=(side * (w / 2 - 0.015), 0, 0.07))
    p.box("slate:metal", (w - 0.2, 0.08, 0.025), at=(0, 0, 0.03))


def stop_pole(p):
    """
    A tram stop's pole, 3.15 m tall: iron, with a round stop sign at its top, over the board with the stop's name (drawn
    by the game at 2.45 m, on its front), and a timetable case at eye height.
    """
    p.cylinder("charcoal:metal", 0.07, 0.12, at=(0, 0, 0.06), segments=10)
    p.cylinder("slate:metal", 0.035, 2.85, at=(0, 0, 1.425), segments=10)
    p.cylinder("denim:paint", 0.2, 0.04, at=(0, 0, 2.95), rot=(math.pi / 2, 0, 0), segments=24)
    p.torus("white:paint", 0.19, 0.015, at=(0, 0, 2.95), rot=(math.pi / 2, 0, 0), segments=24, sides=5)
    p.box("mustard:paint", (0.22, 0.045, 0.08), at=(0, 0, 2.95))
    p.box("charcoal:metal", (0.36, 0.06, 0.5), at=(0, -0.05, 1.45))
    p.box("white:paint", (0.3, 0.01, 0.42), at=(0, -0.085, 1.45))


def rail(p):
    """
    A length of tram track, 4.6 m long and 0.8 m across, which the town stretches to its gauge: two steel rails, each a
    head on a web on a foot, on concrete sleepers every 0.575 m.
    """
    length, half = 4.6, 0.3
    for k in range(8):
        x = -length / 2 + (k + 0.5) * length / 8
        p.box("stone", (0.24, 0.8, 0.07), at=(x, 0, 0.035))
        for side in (-1, 1):
            p.box("charcoal:metal", (0.16, 0.08, 0.012), at=(x, side * half, 0.076))
    for side in (-1, 1):
        y = side * half
        profile = [(-0.05, 0.07), (0.05, 0.07), (0.05, 0.08), (0.012, 0.085), (0.012, 0.1), (0.03, 0.105), (0.03, 0.12), (-0.03, 0.12), (-0.03, 0.105), (-0.012, 0.1), (-0.012, 0.085), (-0.05, 0.08)]
        p.prism("slate:metal", [(y + u, v) for u, v in profile], length, axis="x")


PIECES = {
    "wall": wall,
    "rail": rail,
    "shelter-post": shelter_post,
    "shelter-roof": shelter_roof,
    "stop-pole": stop_pole,
    "quoin": quoin,
    "downpipe": downpipe,
    "wall-window": wall_window,
    "wall-doorway": wall_doorway,
    "door": door,
    "floor": floor,
    "roof-gable": roof_gable,
    "roof-gable-end": roof_gable_end,
    "roof-flat": roof_flat,
    "roof-edge": roof_edge,
    "chimney": chimney,
    "street-light": street_light,
}
