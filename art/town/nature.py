"""
The town's trees, bushes and hedges, put together in code by `pieces.py`: trunks and boughs of bark, and canopies of
leafy clumps, each clump a ball pushed in and out by noise so no two are alike and the outline breaks up. The game
draws `foliage` with a leafy texture over it, so the clumps read as masses of leaves.

In Blender's frame: x and y across, z up, in metres, standing on the ground.
"""

import math
import random

from mathutils import Matrix, Vector, noise

LEAF = "leaf:foliage"
DARK_LEAF = "pine:foliage"
BARK = "walnut:bark"


def clump(p, colour, at, radius, squash=(1.0, 1.0, 1.0), lumps=0.28, seed=0.0, subdivisions=3):
    """A clump of leaves: a ball `radius` across, its surface pushed in and out by noise (`lumps` of its radius)."""
    import bmesh

    made = bmesh.ops.create_icosphere(p.bm, subdivisions=subdivisions, radius=radius, matrix=Matrix.Translation(Vector(at)))
    centre = Vector(at)
    for vert in made["verts"]:
        out = vert.co - centre
        direction = out.normalized()
        bump = noise.noise(direction * 1.8 + Vector((seed, seed * 1.7, seed * 0.3)))
        fine = noise.noise(direction * 4.5 + Vector((seed * 2.1, -seed, seed)))
        scale = 1 + lumps * bump + lumps * 0.4 * fine
        vert.co = centre + Vector((out.x * squash[0], out.y * squash[1], out.z * squash[2])) * scale
    p._paint({face for vert in made["verts"] for face in vert.link_faces}, colour)


def bough(p, a, b, radius_a, radius_b, segments=7):
    """A length of trunk or branch from a to b, tapering from `radius_a` to `radius_b`."""
    a, b = Vector(a), Vector(b)
    direction = b - a
    rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    matrix = Matrix.Translation((a + b) / 2) @ rotation
    import bmesh

    made = bmesh.ops.create_cone(p.bm, cap_ends=True, segments=segments, radius1=radius_a, radius2=radius_b, depth=direction.length, matrix=matrix)
    p._paint({face for vert in made["verts"] for face in vert.link_faces}, BARK)


def trunk(p, height, radius, lean=(0.0, 0.0), seed=0):
    """A trunk with a flared foot, rising `height` with a gentle lean, in three lengths; where its top is."""
    rng = random.Random(seed)
    points = [Vector((0, 0, 0))]
    for k in range(1, 4):
        t = k / 3
        points.append(Vector((lean[0] * t + rng.uniform(-0.06, 0.06), lean[1] * t + rng.uniform(-0.06, 0.06), height * t)))
    bough(p, (0, 0, -0.05), (0, 0, 0.3), radius * 1.35, radius * 1.02, segments=9)
    for k in range(3):
        bough(p, points[k], points[k + 1] + (points[k + 1] - points[k]) * 0.04, radius * (1 - 0.2 * k), radius * (1 - 0.2 * (k + 1)), segments=8)
    return points[-1]


def canopy(p, centre, size, clumps, seed, colours=(LEAF, LEAF, LEAF, LEAF, DARK_LEAF), clump_size=0.42, lumps=0.28):
    """A crown of `clumps` leafy clumps filling an ellipsoid `size` across round `centre`, bigger ones inside."""
    rng = random.Random(seed)
    centre = Vector(centre)
    placed = []
    # The core first, then the clumps round the outside of the crown.
    clump(p, colours[0], centre, min(size) * 0.42, lumps=lumps * 0.6, seed=seed * 0.1)
    while len(placed) < clumps:
        direction = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
        if direction.length < 1e-3:
            continue
        direction.normalize()
        # Fewer underneath: a crown is fuller on top.
        if direction.z < -0.55 and rng.random() < 0.7:
            continue
        reach = rng.uniform(0.55, 0.78)
        at = centre + Vector((direction.x * size[0] / 2 * reach, direction.y * size[1] / 2 * reach, direction.z * size[2] / 2 * reach))
        radius = min(size) * clump_size * rng.uniform(0.75, 1.1)
        colour = colours[rng.randrange(len(colours))]
        clump(p, colour, at, radius, lumps=lumps, seed=seed + len(placed) * 1.37)
        placed.append(at)
    return placed


def branches(p, top, ends, radius):
    """Boughs from the trunk's top out towards some of the crown's clumps."""
    for end in ends:
        end = Vector(end)
        mid = top.lerp(end, 0.5) + Vector((0, 0, 0.15))
        bough(p, top, mid, radius * 0.55, radius * 0.38, segments=6)
        bough(p, mid, top.lerp(end, 0.85), radius * 0.38, radius * 0.2, segments=5)


def deciduous(p, height, crown, trunk_height, clumps, seed, lean=(0.0, 0.0), radius=0.13, clump_size=0.42):
    top = trunk(p, trunk_height, radius, lean, seed)
    centre = Vector((top.x, top.y, height - crown[2] / 2))
    ends = canopy(p, centre, crown, clumps, seed, clump_size=clump_size)
    branches(p, top, ends[:4], radius)


def tree_round(p):
    """A lime tree, about 4.5 m tall: a straight trunk under a full, rounded crown."""
    deciduous(p, 4.5, (1.9, 1.8, 2.4), 2.1, 16, seed=11, radius=0.15, clump_size=0.36)


def tree_oak(p):
    """An oak, about 4 m tall: a short, stout trunk and a broad, spreading crown."""
    deciduous(p, 4.0, (2.2, 2.0, 1.9), 1.8, 18, seed=23, lean=(0.12, -0.05), radius=0.19, clump_size=0.34)


def tree_tall(p):
    """A poplar, about 4.6 m tall: a slim column of leaves."""
    deciduous(p, 4.6, (1.0, 1.0, 3.4), 1.2, 12, seed=31, radius=0.11, clump_size=0.42)


def tree_fat(p):
    """A horse chestnut, about 3.8 m tall: a wide dome of leaves almost to the ground."""
    deciduous(p, 3.8, (2.1, 2.0, 2.4), 1.4, 18, seed=41, radius=0.18, clump_size=0.36)


def tree_small(p):
    """A young street tree, about 3 m tall, staked: a slim trunk and a small crown."""
    deciduous(p, 3.0, (1.0, 0.95, 1.3), 1.7, 9, seed=53, radius=0.075, clump_size=0.42)
    p.rod("wood:wood", (0.16, 0, 0), (0.16, 0, 1.4), 0.025, segments=5)
    p.rod("wood:wood", (0.16, 0, 1.1), (0, 0, 1.1), 0.015, segments=4)


def conifer(p, height, base_radius, tiers, seed, colour=DARK_LEAF):
    """A conifer: a trunk under tiers of drooping, needled skirts, narrowing to a spire."""
    import bmesh

    rng = random.Random(seed)
    bough(p, (0, 0, -0.05), (0, 0, height * 0.45), base_radius * 0.12, base_radius * 0.07, segments=7)
    for k in range(tiers):
        t = k / tiers
        bottom = height * (0.12 + 0.8 * t)
        radius = base_radius * (1 - t) ** 0.9 + 0.08
        depth = height * 0.3 * (1 - 0.4 * t)
        segments = 14
        ring, rim = [], []
        for i in range(segments):
            angle = 2 * math.pi * (i + rng.random() * 0.3) / segments
            r = radius * (0.85 + 0.25 * rng.random())
            droop = 0.12 * rng.random()
            rim.append(p.bm.verts.new((r * math.cos(angle), r * math.sin(angle), bottom - droop)))
            ring.append(p.bm.verts.new((r * 0.45 * math.cos(angle), r * 0.45 * math.sin(angle), bottom + depth * 0.25)))
        apex = p.bm.verts.new((0, 0, bottom + depth))
        under = p.bm.verts.new((0, 0, bottom + depth * 0.08))
        faces = []
        for i in range(segments):
            j = (i + 1) % segments
            faces.append(p.bm.faces.new((rim[i], rim[j], ring[j], ring[i])))
            faces.append(p.bm.faces.new((ring[i], ring[j], apex)))
            faces.append(p.bm.faces.new((rim[j], rim[i], under)))
        bmesh.ops.recalc_face_normals(p.bm, faces=faces)
        p._paint(faces, colour)


def tree_pine(p):
    """A Scots pine, about 3.3 m tall in the hills (the town sizes them): tiers of dark needles."""
    conifer(p, 3.3, 0.72, 6, seed=61)


def tree_cone(p):
    """A spruce, about 3.7 m tall: a narrow cone of dark needles."""
    conifer(p, 3.7, 0.68, 8, seed=71)


def bush(p):
    """A rounded shrub, about 0.95 m tall and 1.5 m across."""
    rng = random.Random(81)
    for k in range(6):
        angle = k / 6 * 2 * math.pi + rng.random()
        r = 0.32 if k else 0.0
        clump(p, LEAF if k % 3 else DARK_LEAF, (r * math.cos(angle), r * math.sin(angle), 0.48), 0.42 * rng.uniform(0.85, 1.05), squash=(1, 1, 0.9), seed=k * 2.3)


def bush_large(p):
    """A low, spreading shrub, about 0.65 m tall and 1 m across, flowering."""
    rng = random.Random(91)
    for k in range(5):
        angle = k / 5 * 2 * math.pi + rng.random()
        r = 0.22 if k else 0.0
        clump(p, LEAF, (r * math.cos(angle), r * math.sin(angle), 0.32), 0.3 * rng.uniform(0.85, 1.05), squash=(1, 1, 0.85), seed=k * 3.1 + 7)
    for k in range(9):
        angle = rng.random() * 2 * math.pi
        p.ball("blush", 0.04, at=(0.4 * math.cos(angle), 0.4 * math.sin(angle), 0.35 + 0.22 * rng.random()), subdivisions=1)


def hedge(p):
    """A clipped box hedge, 2 m long, 1.2 m tall and 0.8 m deep: square cut, but leafy at its surface."""
    import bmesh

    made = bmesh.ops.create_cube(p.bm, size=1.0)
    bmesh.ops.subdivide_edges(p.bm, edges=list({e for v in made["verts"] for e in v.link_edges}), cuts=6, use_grid_fill=True)
    for vert in list(p.bm.verts):
        x, y, z = vert.co
        bump = 0.035 * noise.noise(Vector((x * 6, y * 6, z * 6)))
        vert.co = Vector((x * 1.96 + bump, y * 0.76 + bump, (z + 0.5) * 1.17 + bump))
    p._paint(set(p.bm.faces), LEAF)


PIECES = {
    "tree-round": tree_round,
    "tree-oak": tree_oak,
    "tree-tall": tree_tall,
    "tree-fat": tree_fat,
    "tree-small": tree_small,
    "tree-pine": tree_pine,
    "tree-cone": tree_cone,
    "bush": bush,
    "bush-large": bush_large,
    "hedge": hedge,
}
