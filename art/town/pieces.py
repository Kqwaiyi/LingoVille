"""
The town's own pieces, for what Kenney's kits lack: modelled in code, so `town.blend` can be rebuilt from this file.

Run inside Blender (5.x), from the repo root or with the path to this file:
    blender art/town/town.blend --background --python art/town/pieces.py
It rebuilds every piece in the scene's `pieces` collection, saves `town.blend`, and exports each piece to
`art/town/glb/<piece>.glb`, which `scripts/build-town.ts` reads as its `town-art` kit.

Each piece is one object named for the piece, standing on the ground with its front facing -Y (glTF's +z), in metres.
Every material is a palette colour (`src/world/palette.ts`), named after it: the town build snaps to the palette anyway,
and repaints some of them per use (an awning's stripes, a bicycle's frame).
"""

import math
import os
import re

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.path.join(os.getcwd(), "art", "town")
ROOT = os.path.dirname(os.path.dirname(HERE))
GLB = os.path.join(HERE, "glb")


def read_palette():
    """The palette's colours, by name, from `src/world/palette.ts`."""
    with open(os.path.join(ROOT, "src", "world", "palette.ts"), encoding="utf8") as file:
        return dict(re.findall(r"^\s+([a-z]+): '(#[0-9a-f]{6})',", file.read(), re.M))


PALETTE = read_palette()


def linear(hex_colour):
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(channel(hex_colour[i : i + 2]) for i in (1, 3, 5))


def material(name):
    """The flat, matte material for a palette colour; or `glass`, a window's, sky blue, which the game lights."""
    found = bpy.data.materials.get(name)
    if found:
        return found
    made = bpy.data.materials.new(name)
    rgb = (*linear(PALETTE["sky" if name == "glass" else name]), 1.0)
    made.diffuse_color = rgb
    bsdf = made.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgb
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    return made


def transform(at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.Translation(Vector(at)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))


class Piece:
    """One piece's mesh, put together from parts, each in a palette colour."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.colours = []

    def _paint(self, faces, colour):
        if colour not in self.colours:
            self.colours.append(colour)
        for face in faces:
            face.material_index = self.colours.index(colour)

    def _faces_of(self, verts):
        return {face for vert in verts for face in vert.link_faces}

    def box(self, colour, size, at=(0, 0, 0), rot=(0, 0, 0)):
        made = bmesh.ops.create_cube(self.bm, size=1, matrix=transform(at, rot, size))
        self._paint(self._faces_of(made["verts"]), colour)

    def cylinder(self, colour, radius, depth, at=(0, 0, 0), rot=(0, 0, 0), segments=12, top=None, scale=(1, 1)):
        """A cylinder (or cone, with `top` its top radius) standing on its own middle, along its local z."""
        made = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            radius1=radius,
            radius2=radius if top is None else top,
            depth=depth,
            matrix=transform(at, rot, (scale[0], scale[1], 1)),
        )
        self._paint(self._faces_of(made["verts"]), colour)

    def rod(self, colour, a, b, radius, segments=6):
        """A thin cylinder from point a to point b."""
        a, b = Vector(a), Vector(b)
        direction = b - a
        rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
        matrix = Matrix.Translation((a + b) / 2) @ rotation
        made = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=direction.length, matrix=matrix)
        self._paint(self._faces_of(made["verts"]), colour)

    def ball(self, colour, radius, at=(0, 0, 0), scale=(1, 1, 1), subdivisions=1):
        made = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=radius, matrix=transform(at, (0, 0, 0), scale))
        self._paint(self._faces_of(made["verts"]), colour)

    def torus(self, colour, major, minor, at=(0, 0, 0), rot=(0, 0, 0), segments=16, sides=6):
        matrix = transform(at, rot)
        rings = []
        for i in range(segments):
            u = 2 * math.pi * i / segments
            ring = []
            for j in range(sides):
                v = 2 * math.pi * j / sides
                point = Vector(((major + minor * math.cos(v)) * math.cos(u), (major + minor * math.cos(v)) * math.sin(u), minor * math.sin(v)))
                ring.append(self.bm.verts.new(matrix @ point))
            rings.append(ring)
        faces = []
        for i in range(segments):
            for j in range(sides):
                a, b = rings[i], rings[(i + 1) % segments]
                faces.append(self.bm.faces.new((a[j], b[j], b[(j + 1) % sides], a[(j + 1) % sides])))
        self._paint(faces, colour)

    def polygon(self, colour, points, double=False):
        """A flat face through `points` (in order, anticlockwise seen from its front); `double` adds its back."""
        faces = [self.bm.faces.new([self.bm.verts.new(p) for p in points])]
        if double:
            faces.append(self.bm.faces.new([self.bm.verts.new(p) for p in reversed(points)]))
        self._paint(faces, colour)

    def prism(self, colour, points, thickness, axis="y"):
        """A flat shape (points in the plane across `axis`, as (u, v) pairs) given a little thickness along `axis`."""

        def place(u, v, w):
            return {"x": (w, u, v), "y": (u, w, v), "z": (u, v, w)}[axis]

        half = thickness / 2
        front = [self.bm.verts.new(place(u, v, -half)) for u, v in points]
        back = [self.bm.verts.new(place(u, v, half)) for u, v in points]
        faces = [self.bm.faces.new(front), self.bm.faces.new(list(reversed(back)))]
        for i in range(len(points)):
            j = (i + 1) % len(points)
            faces.append(self.bm.faces.new((front[j], front[i], back[i], back[j])))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._paint(faces, colour)

    def finish(self, collection, place_at):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for colour in self.colours:
            mesh.materials.append(material(colour))
        for polygon in mesh.polygons:
            polygon.use_smooth = False
        made = bpy.data.objects.new(self.name, mesh)
        made.location = place_at
        collection.objects.link(made)
        return made


# The pieces. Each function puts one together.


def awning(p):
    """A shop's striped canvas awning, 2 m wide, sloping 1 m out from the wall: its stripes red and white, repainted per shop."""
    stripes, width, out, drop, top = 8, 2.0, 1.0, 0.45, 0.75
    slope = math.atan2(drop, out)
    length = math.hypot(out, drop)
    each = width / stripes
    for i in range(stripes):
        colour = "red" if i % 2 == 0 else "white"
        x = -width / 2 + (i + 0.5) * each
        p.box(colour, (each, length, 0.04), at=(x, -out / 2, top - drop / 2), rot=(slope, 0, 0))
        # The valance, hanging from the front edge, scalloped by turns.
        p.box(colour, (each, 0.03, 0.22 if i % 2 == 0 else 0.17), at=(x, -out - 0.01, top - drop - (0.11 if i % 2 == 0 else 0.085)))
    for side in (-1, 1):
        p.box("ink", (0.03, out, 0.03), at=(side * (width / 2 - 0.03), -out / 2, top - drop - 0.02))
        p.rod("ink", (side * (width / 2 - 0.03), 0, top - drop - 0.35), (side * (width / 2 - 0.03), -out * 0.95, top - drop - 0.02), 0.015)


def pennants(p):
    """A string of pennants, 10 m long, sagging 0.5 m: hung across the street from wall to wall."""
    length, sag, colours = 10.0, 0.5, ["red", "mustard", "sky", "mint", "blush", "lavender", "white"]
    flag_height, flag_width = 0.36, 0.3
    top = sag + flag_height

    def height(x):
        return top - sag * (1 - (2 * x / length) ** 2)

    steps = 20
    for i in range(steps):
        x0, x1 = -length / 2 + i * length / steps, -length / 2 + (i + 1) * length / steps
        p.rod("ink", (x0, 0, height(x0)), (x1, 0, height(x1)), 0.012, segments=4)
    count = int(length / 0.5)
    for i in range(count):
        x = -length / 2 + (i + 0.5) * length / count
        z = height(x)
        p.prism(colours[i % len(colours)], [(x - flag_width / 2, z), (x, z - flag_height), (x + flag_width / 2, z)], 0.012)


def window_box(p):
    """A wooden box of flowers under a window, 1 m long."""
    p.box("wood", (1.0, 0.24, 0.2), at=(0, 0, 0.1))
    p.box("walnut", (1.04, 0.27, 0.04), at=(0, 0, 0.02))
    p.box("walnut", (0.94, 0.18, 0.02), at=(0, 0, 0.2))
    flowers = ["red", "blush", "mustard", "white", "red", "lavender", "blush"]
    for i, colour in enumerate(flowers):
        x = -0.42 + i * 0.14
        p.ball("leaf", 0.09, at=(x, 0.01 * (i % 2), 0.26), scale=(1, 0.8, 0.8))
        p.ball(colour, 0.05, at=(x + 0.03, -0.05, 0.33 + 0.03 * (i % 3)))


def bicycle(p):
    """A town bike with a basket, side on: its frame denim, repainted per bike."""
    r, axle = 0.33, 0.35
    rear, front, crank = (-0.52, 0, axle), (0.52, 0, axle), (0.0, 0, 0.32)
    seat, head_top, head_low = (-0.12, 0, 0.82), (0.38, 0, 0.84), (0.42, 0, 0.66)
    for x in (-0.52, 0.52):
        p.torus("ink", r, 0.028, at=(x, 0, axle), rot=(math.pi / 2, 0, 0), segments=16, sides=5)
        p.cylinder("stone", 0.04, 0.06, at=(x, 0, axle), rot=(math.pi / 2, 0, 0), segments=8)
        for k in range(4):
            angle = k * math.pi / 4
            p.rod("stone", (x - r * math.cos(angle), 0, axle - r * math.sin(angle)), (x + r * math.cos(angle), 0, axle + r * math.sin(angle)), 0.006, segments=3)
    for a, b in [(crank, seat), (seat, head_top), (crank, head_low), (crank, rear), (seat, rear), (head_top, front)]:
        p.rod("denim", a, b, 0.022)
    p.box("ink", (0.24, 0.1, 0.05), at=(-0.15, 0, 0.88))
    p.rod("ink", (0.36, -0.24, 0.98), (0.36, 0.24, 0.98), 0.016)
    p.rod("denim", head_top, (0.36, 0, 0.98), 0.02)
    p.cylinder("ink", 0.09, 0.03, at=crank, rot=(math.pi / 2, 0, 0), segments=10)
    # The basket, on the front, and the mudguards.
    p.box("wood", (0.3, 0.32, 0.2), at=(0.6, 0, 0.9))
    p.box("walnut", (0.26, 0.28, 0.02), at=(0.6, 0, 1.0))
    for x in (-0.52, 0.52):
        p.box("denim", (0.36, 0.06, 0.02), at=(x, 0, axle + r + 0.05))


def parasol(p):
    """A café parasol over a table: eight panels, red and white by turns, 2.2 m across."""
    rim, apex, radius, panels = 2.05, 2.45, 1.1, 8
    p.cylinder("charcoal", 0.3, 0.08, at=(0, 0, 0.04), segments=10)
    p.cylinder("white", 0.03, apex, at=(0, 0, apex / 2), segments=8)
    for i in range(panels):
        a0, a1 = 2 * math.pi * i / panels, 2 * math.pi * (i + 1) / panels
        colour = "red" if i % 2 == 0 else "white"
        c0 = (radius * math.cos(a0), radius * math.sin(a0), rim)
        c1 = (radius * math.cos(a1), radius * math.sin(a1), rim)
        p.polygon(colour, [c0, c1, (0, 0, apex)], double=True)
        p.polygon(colour, [(c0[0], c0[1], rim - 0.12), (c1[0], c1[1], rim - 0.12), c1, c0], double=True)
    p.ball("white", 0.05, at=(0, 0, apex + 0.03))


def street_clock(p):
    """A cast-iron post clock for the square: two white faces on a dark green post, 3.6 m tall."""
    p.box("charcoal", (0.62, 0.62, 0.22), at=(0, 0, 0.11))
    p.box("charcoal", (0.46, 0.46, 0.3), at=(0, 0, 0.37))
    p.cylinder("pine", 0.1, 2.6, at=(0, 0, 1.82), segments=10)
    for z in (0.62, 1.4, 3.0):
        p.cylinder("mustard", 0.14, 0.06, at=(0, 0, z), segments=10)
    p.cylinder("pine", 0.16, 0.2, at=(0, 0, 3.08), top=0.1, segments=10)
    head = 3.5
    p.cylinder("pine", 0.4, 0.22, at=(0, 0, head), rot=(math.pi / 2, 0, 0), segments=20)
    for side in (-1, 1):
        y = side * 0.115
        p.cylinder("white", 0.34, 0.02, at=(0, y, head), rot=(math.pi / 2, 0, 0), segments=20)
        p.torus("mustard", 0.36, 0.02, at=(0, y, head), rot=(math.pi / 2, 0, 0), segments=20, sides=4)
        for k in range(12):
            angle = k * math.pi / 6
            p.box("ink", (0.025, 0.01, 0.06 if k % 3 == 0 else 0.035), at=(0.29 * math.sin(angle), y + side * 0.012, head + 0.29 * math.cos(angle)), rot=(0, angle, 0))
        # Ten past ten.
        for length, angle, width in ((0.17, -math.radians(55), 0.03), (0.26, math.radians(60), 0.02)):
            p.box("ink", (width, 0.01, length), at=(length / 2 * math.sin(angle), y + side * 0.02, head + length / 2 * math.cos(angle)), rot=(0, angle, 0))
    p.cylinder("mustard", 0.08, 0.3, at=(0, 0, head + 0.52), top=0.0, segments=8)
    p.ball("mustard", 0.06, at=(0, 0, head + 0.38))


def hill(p, size=(44.0, 30.0), height=10.0, seed=0.0, colours=("grass", "leaf", "pine"), crown=0.85):
    """A rolling hill, open underneath, for the backdrop: grass low down, leaf green up its sides and a pine crown."""
    nx, ny = 26, 18
    (sx, sy) = size
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx * 2 - 1, j / ny * 2 - 1
            r = min(1.0, math.hypot(u, v))
            falloff = 0.5 + 0.5 * math.cos(math.pi * r)
            bumps = 1 + 0.18 * noise.noise(Vector((u * 1.6 + seed, v * 1.6 - seed, seed * 0.7)))
            z = max(0.0, height * falloff * bumps - 0.02)
            row.append(p.bm.verts.new((u * sx / 2, v * sy / 2, z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            a, b, c, d = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
            for tri in ((a, b, c), (a, c, d)):
                face = p.bm.faces.new(tri)
                face.normal_update()
                middle = sum((v.co.z for v in tri), 0.0) / 3
                colour = colours[2] if middle > height * crown else colours[1] if middle > height * 0.12 else colours[0]
                p._paint([face], colour)


def mountain(p):
    """A far mountain for the horizon: pine slopes, grey crags and a white top, faded by the fog."""
    hill(p, size=(80.0, 46.0), height=30.0, seed=3.1, colours=("pine", "slate", "white"), crown=0.72)


def bath(p):
    """The bathhouse's soaking tub: a cedar frame round steaming water, 3 m by 2.2 m, with a step up at its front."""
    w, d, h, t = 3.0, 2.2, 0.55, 0.14
    p.box("stone", (w + 0.5, d + 0.5, 0.05), at=(0, 0, 0.025))
    p.box("wood", (w, d, 0.1), at=(0, 0, 0.1))
    for side in (-1, 1):
        p.box("wood", (w, t, h), at=(0, side * (d - t) / 2, h / 2 + 0.05))
        p.box("wood", (t, d, h), at=(side * (w - t) / 2, 0, h / 2 + 0.05))
        p.box("walnut", (w + 0.06, t + 0.06, 0.05), at=(0, side * (d - t) / 2, h + 0.075))
        p.box("walnut", (t + 0.06, d + 0.06, 0.05), at=(side * (w - t) / 2, 0, h + 0.075))
    for k in range(1, 6):
        p.box("walnut", (0.02, 0.01, h - 0.05), at=(-w / 2 + k * w / 6, -d / 2 - 0.005, h / 2 + 0.05))
    p.box("sky", (w - 2 * t, d - 2 * t, 0.04), at=(0, 0, h - 0.08))
    p.box("wood", (1.0, 0.4, 0.22), at=(0, -d / 2 - 0.2, 0.11))
    # A bamboo spout pouring in at the back.
    p.rod("leaf", (w / 2 - 0.5, d / 2 + 0.05, h + 0.45), (w / 2 - 0.5, d / 2 - 0.35, h + 0.3), 0.04)
    p.box("white", (0.05, 0.05, 0.3), at=(w / 2 - 0.5, d / 2 - 0.37, h + 0.12))


def planter(p):
    """A wooden street planter, 1.4 m long, with a shrub and flowers."""
    p.box("wood", (1.4, 0.55, 0.45), at=(0, 0, 0.225))
    for z in (0.06, 0.42):
        p.box("walnut", (1.44, 0.59, 0.05), at=(0, 0, z))
    p.box("walnut", (1.3, 0.45, 0.02), at=(0, 0, 0.45))
    for x, r in ((-0.35, 0.3), (0.2, 0.34), (0.5, 0.22)):
        p.ball("leaf", r, at=(x, 0, 0.5 + r * 0.6), scale=(1, 0.8, 0.85))
    for x, colour in ((-0.55, "red"), (-0.1, "mustard"), (0.4, "blush"), (0.62, "red"), (0.0, "white")):
        p.ball(colour, 0.06, at=(x, -0.2, 0.62 + 0.05 * (x > 0)))


def catenary_pole(p):
    """A tram line's pole, standing between the two tracks, with arms out over each (2.5 m either side) to carry the wires."""
    p.cylinder("charcoal", 0.16, 0.3, at=(0, 0, 0.15), segments=8)
    p.cylinder("charcoal", 0.08, 5.6, at=(0, 0, 2.95), segments=8)
    p.ball("charcoal", 0.1, at=(0, 0, 5.78))
    p.rod("charcoal", (0, -2.8, 5.3), (0, 2.8, 5.3), 0.035)
    for side in (-1, 1):
        p.rod("charcoal", (0, 0, 4.6), (0, side * 1.6, 5.3), 0.025)
        p.cylinder("white", 0.04, 0.16, at=(0, side * 2.5, 5.18), segments=6)


def boat(p):
    """A small wooden rowing boat, 3.2 m long, moored on the canal."""
    stations = [(-1.6, 0.42, 0.5), (-0.9, 0.62, 0.48), (0.0, 0.66, 0.48), (0.9, 0.52, 0.52), (1.6, 0.04, 0.68)]
    outside, inside = [], []
    for x, half, top in stations:
        outside.append([p.bm.verts.new((x, -half, top)), p.bm.verts.new((x, -half * 0.45, 0.0)), p.bm.verts.new((x, half * 0.45, 0.0)), p.bm.verts.new((x, half, top))])
        inside.append([p.bm.verts.new((x, -half * 0.9, top)), p.bm.verts.new((x, -half * 0.4, 0.08)), p.bm.verts.new((x, half * 0.4, 0.08)), p.bm.verts.new((x, half * 0.9, top))])
    for k in range(len(stations) - 1):
        a, b = outside[k], outside[k + 1]
        p._paint([p.bm.faces.new((a[0], b[0], b[1], a[1])), p.bm.faces.new((a[2], b[2], b[3], a[3]))], "white")
        p._paint([p.bm.faces.new((a[1], b[1], b[2], a[2]))], "red")
        c, e = inside[k], inside[k + 1]
        p._paint([p.bm.faces.new((c[1], e[1], e[0], c[0])), p.bm.faces.new((c[3], e[3], e[2], c[2])), p.bm.faces.new((c[2], e[2], e[1], c[1]))], "wood")
        for side in (0, 3):
            p._paint([p.bm.faces.new((a[side], c[side], e[side], b[side]) if side == 0 else (b[side], e[side], c[side], a[side]))], "walnut")
    stern, stern_in = outside[0], inside[0]
    p._paint([p.bm.faces.new(list(reversed(stern)))], "white")
    p._paint([p.bm.faces.new(stern_in)], "wood")
    p._paint([p.bm.faces.new((stern[0], stern[3], stern_in[3], stern_in[0]))], "walnut")
    for x in (-0.8, 0.3):
        p.box("wood", (0.22, 1.05, 0.05), at=(x, 0, 0.36))
    p.rod("wood", (-0.2, -0.75, 0.42), (0.9, -0.5, 0.3), 0.025)
    p.box("wood", (0.4, 0.12, 0.02), at=(1.05, -0.47, 0.28))


def gazebo(p):
    """The park's bandstand: a white hexagonal pavilion on a stone base, with a red roof, 5.2 m across."""
    radius, posts_at, eave, apex = 2.6, 2.3, 2.75, 4.1
    p.cylinder("stone", radius, 0.3, at=(0, 0, 0.15), segments=6)
    p.cylinder("wood", radius - 0.12, 0.04, at=(0, 0, 0.32), segments=6)
    corners = [(math.cos(math.pi / 6 + k * math.pi / 3), math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    for cx, cy in corners:
        p.cylinder("white", 0.08, eave - 0.3, at=(cx * posts_at, cy * posts_at, 0.3 + (eave - 0.3) / 2), segments=8)
    for k in range(6):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 6]
        a, b = (ax * posts_at, ay * posts_at), (bx * posts_at, by * posts_at)
        p.rod("white", (*a, eave - 0.05), (*b, eave - 0.05), 0.06, segments=4)
        # Railings all round but the side facing the front, where the steps are.
        if abs((ay + by) / 2 + 1) > 0.2:
            p.rod("white", (*a, 1.2), (*b, 1.2), 0.035, segments=4)
            for t in (0.25, 0.5, 0.75):
                x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                p.rod("white", (x, y, 0.34), (x, y, 1.2), 0.02, segments=4)
    for k in range(6):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 6]
        r = radius + 0.3
        a, b = (ax * r, ay * r, eave), (bx * r, by * r, eave)
        p.polygon("red", [a, b, (0, 0, apex)], double=True)
        p.polygon("white", [(a[0], a[1], eave - 0.16), (b[0], b[1], eave - 0.16), b, a], double=True)
    p.cylinder("mustard", 0.07, 0.5, at=(0, 0, apex + 0.2), top=0.0, segments=6)
    p.box("stone", (1.6, 0.5, 0.15), at=(0, -radius * 0.87 - 0.25, 0.075))


def house(p, width, depth, storeys, roof_height, door=True):
    """
    A house for the backdrop, side on to nobody: walls lavender and roof charcoal (the colours the town's kit walls and
    roofs come in, which each house repaints), cream trim, and window glass the game lights at night.
    """
    storey = 2.8
    walls = storey * storeys
    p.box("lavender", (width, depth, walls), at=(0, 0, walls / 2))
    p.box("cream", (width + 0.12, depth + 0.12, 0.25), at=(0, 0, 0.125))
    for k in range(1, storeys):
        p.box("cream", (width + 0.08, depth + 0.08, 0.12), at=(0, 0, k * storey))
    # The gable roof, its ridge along the front, and its end walls.
    overhang, half = 0.3, depth / 2 + 0.3
    slope = math.atan2(roof_height, half)
    length = math.hypot(half, roof_height)
    for side in (-1, 1):
        p.box("charcoal", (width + 2 * overhang, length, 0.14), at=(0, side * half / 2, walls + roof_height / 2), rot=(side * -slope, 0, 0))
        p.prism("lavender", [(-depth / 2, walls), (depth / 2, walls), (0, walls + roof_height - 0.1)], 0.02, axis="x")
        p.bm.verts.ensure_lookup_table()
        for vert in p.bm.verts[-6:]:
            vert.co.x += side * width / 2
    p.box("brick", (0.5, 0.5, roof_height + 0.9), at=(width / 2 - 0.9, depth / 4, walls + (roof_height + 0.9) / 2))
    # Windows on every storey, front and back, and the front door.
    across = max(1, round(width / 2.2))
    for k in range(storeys):
        for i in range(across):
            x = -width / 2 + (i + 0.5) * width / across
            if door and k == 0 and i == across // 2:
                p.box("walnut", (0.95, 0.08, 2.0), at=(x, -depth / 2 - 0.02, 1.05))
                p.box("cream", (1.2, 0.1, 0.15), at=(x, -depth / 2 - 0.03, 2.12))
                continue
            for side in (-1, 1):
                y = side * (depth / 2 + 0.02)
                p.box("cream", (0.95, 0.06, 1.25), at=(x, y, k * storey + 1.55))
                p.box("glass", (0.75, 0.08, 1.05), at=(x, y, k * storey + 1.55))
                p.box("cream", (1.05, 0.16, 0.08), at=(x, y + side * 0.04, k * storey + 0.95))


def cottage(p):
    """A cottage for the hills: one storey and a steep roof, 6 m by 5 m."""
    house(p, 6.0, 5.0, 1, 2.4)


def townhouse(p):
    """A narrow townhouse for the streets behind: three storeys, 5 m by 6 m."""
    house(p, 5.0, 6.0, 3, 1.8)


PIECES = {
    "awning": awning,
    "pennants": pennants,
    "window-box": window_box,
    "bicycle": bicycle,
    "parasol": parasol,
    "street-clock": street_clock,
    "hill": hill,
    "mountain": mountain,
    "bath": bath,
    "planter": planter,
    "catenary-pole": catenary_pole,
    "boat": boat,
    "gazebo": gazebo,
    "cottage": cottage,
    "townhouse": townhouse,
}


def build():
    collection = bpy.data.collections.get("pieces")
    if collection is None:
        collection = bpy.data.collections.new("pieces")
        bpy.context.scene.collection.children.link(collection)
    for made in list(collection.objects):
        mesh = made.data
        bpy.data.objects.remove(made)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    # Laid out in a row to look at in the .blend; the build stands each on its own footprint anyway.
    x = 0.0
    made = {}
    for name, put_together in PIECES.items():
        piece = Piece(name)
        put_together(piece)
        width = max((v.co.x for v in piece.bm.verts), default=0) - min((v.co.x for v in piece.bm.verts), default=0)
        x += width / 2
        made[name] = piece.finish(collection, (x, 0, 0))
        x += width / 2 + 2
    return made


def export(made):
    os.makedirs(GLB, exist_ok=True)
    for name, piece in made.items():
        for other in bpy.context.scene.objects:
            other.select_set(False)
        piece.select_set(True)
        bpy.context.view_layer.objects.active = piece
        location = piece.location.copy()
        piece.location = (0, 0, 0)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(GLB, f"{name}.glb"),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_normals=True,
            export_texcoords=False,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
            export_animations=False,
        )
        piece.location = location


made = build()
export(made)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "town.blend"))
result = {name: [round(v, 2) for v in piece.dimensions] for name, piece in made.items()}
print(result)
