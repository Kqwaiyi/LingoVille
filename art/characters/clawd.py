"""
Clawd, the Claude Code mascot, as everyone in town: the Character, the Named NPCs, Shift Customers and Passers-by.
Modelled, rigged and animated in code, so `clawd.blend` and the game's character art can be rebuilt from this file.

Run inside Blender (5.x), from the repo root or with the path to this file:
    blender art/characters/clawd.blend --background --python art/characters/clawd.py
It rebuilds the figure in the scene's `clawd` collection, saves `clawd.blend`, and exports `public/characters/clawd.glb`,
which the game loads as it is.

The shape follows the mascot as Claude Code's welcome screen draws it: a block of orange about twice as wide as it is
tall, two tall black eyes a quarter of the way in from each side, a stubby arm on each side level with the eyes, and
four short legs below, two at each end. In 3D it's a little deeper and taller than the sprite, with soft edges.

- The figure stands on the ground facing -Y (glTF's +z), in metres. Its rig (`root`, `body`, an arm each side and the
  four legs) moves rigid parts: everything on the body (the eyes and whatever is worn) is skinned to `body`.
- The eyes are their own mesh, with shape keys the game eases between: `blink`, `puzzled` and `strained`. The body bone
  carries the expressions' tilt and nod, which the game adds on top of the clip.
- What tells people apart is what they wear: hats, eyewear and neckwear, one mesh each, named `hat-*`, `eyewear-*` and
  `neckwear-*`, which the game shows or hides. Staff wear an `apron`, and `sweat` shows while someone is strained.
- Clips (actions): `idle`, `walk` and `talk`.
- Every material is named for its colour: a palette colour (`src/world/palette.ts`), with `:gloss` for a shiny finish,
  or `accent` and `apron`, which the game tints with a look's colour or a role's.
"""

import math
import os
import re

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.path.join(os.getcwd(), "art", "characters")
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "characters", "clawd.glb")


def read_palette():
    """The palette's colours, by name, from `src/world/palette.ts`: the town's, and Clawd's own."""
    with open(os.path.join(ROOT, "src", "world", "palette.ts"), encoding="utf8") as file:
        return dict(re.findall(r"^\s+([a-z]+): '(#[0-9a-f]{6})',", file.read(), re.M))


PALETTE = read_palette()

# The figure, in metres. The body's width, depth and height, the legs' length below it, and how round its edges are.
W, D, H, L = 1.0, 0.66, 0.6, 0.24
ROUND = 0.09
TOP = L + H
FRONT = -D / 2
# The eyes: tall, a quarter of the width in from each side, their middles this far up the body.
EYE = {"x": W / 4, "z": L + 0.63 * H, "width": 0.088, "height": 0.165, "proud": 0.014}
# The arms: stubby, sticking out of each side level with the eyes.
ARM = {"z": L + 0.6 * H, "out": 0.11, "depth": 0.2, "height": 0.16}
# The legs: two at each end, the outer pair flush with the sides.
LEG = {"xs": (0.43, 0.27), "width": 0.1, "depth": 0.13}
FPS = 30
# How big Clawd stands in town: everything here is modelled for a body a metre wide, and built this much bigger.
SCALE = 1.3

# How each material looks: roughness, by colour (anything else is fabric), and for a glossy finish (`colour:gloss`).
ROUGHNESS = {"clawd": 0.5, "ink": 0.4, "mustard": 0.4}
GLOSS = 0.18


def linear(hex_colour):
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(channel(hex_colour[i : i + 2]) for i in (1, 3, 5))


# The tinted materials, drawn in the colour the game gives them; white here.
TINTED = ("accent", "apron")


def material(name):
    """
    The material named for its colour: a palette colour, with `:gloss` for a shiny finish (the eyes, a glint, a drop
    of sweat), or one the game tints (`accent`, `apron`).
    """
    found = bpy.data.materials.get(name)
    if found:
        return found
    made = bpy.data.materials.new(name)
    colour, _, finish = name.partition(":")
    rgb = (1.0, 1.0, 1.0, 1.0) if name in TINTED else (*linear(PALETTE[colour]), 1.0)
    made.diffuse_color = rgb
    made.use_nodes = True
    bsdf = made.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgb
    bsdf.inputs["Roughness"].default_value = GLOSS if finish == "gloss" else ROUGHNESS.get(colour, 0.85)
    bsdf.inputs["Metallic"].default_value = 0.0
    return made


def transform(at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.Translation(Vector(at)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))


class Part:
    """One mesh, put together from shapes, each in a colour and each moved by one bone."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.colours = []
        self.bones = []

    def _new(self, before):
        """The vertices made since there were `before` of them: new ones go on the end, and nothing older goes."""
        self.bm.verts.ensure_lookup_table()
        return [self.bm.verts[i] for i in range(before, len(self.bm.verts))]

    def _take(self, verts, colour, bone):
        if colour not in self.colours:
            self.colours.append(colour)
        if bone not in self.bones:
            self.bones.append(bone)
        for face in {face for vert in verts for face in vert.link_faces}:
            face.material_index = self.colours.index(colour)
            face.smooth = True
        for vert in verts:
            vert[self.deform][self.bones.index(bone)] = 1.0
        return verts

    def rounded_box(self, colour, size, at=(0, 0, 0), radius=0.02, rot=(0, 0, 0), bone="body", segments=3):
        """A box with its edges rounded off, standing on its own middle."""
        before = len(self.bm.verts)
        made = bmesh.ops.create_cube(self.bm, size=1, matrix=transform(at, rot, size))
        verts = made["verts"]
        edges = list({edge for vert in verts for edge in vert.link_edges})
        if radius > 0:
            bmesh.ops.bevel(self.bm, geom=verts + edges, offset=radius, offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
        return self._take(self._new(before), colour, bone)

    def ball(self, colour, radius, at=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), bone="body", subdivisions=2):
        before = len(self.bm.verts)
        bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=radius, matrix=transform(at, rot, scale))
        return self._take(self._new(before), colour, bone)

    def uv_ball(self, colour, radius, at=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), bone="body", segments=20, rings=10, top_only=False):
        before = len(self.bm.verts)
        made = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings, radius=radius, matrix=transform(at, rot, scale))
        if top_only:
            # A dome: the bottom half goes, and the rim closes with a flat face.
            centre_z = Vector(at).z
            below = [v for v in made["verts"] if v.co.z < centre_z - 1e-5]
            bmesh.ops.delete(self.bm, geom=below, context="VERTS")
            rim = {e for v in self._new(before) for e in v.link_edges if e.is_boundary}
            if rim:
                filled = bmesh.ops.edgeloop_fill(self.bm, edges=list(rim))
                for face in filled["faces"]:
                    for edge in face.edges:
                        edge.smooth = False
        return self._take(self._new(before), colour, bone)

    def cylinder(self, colour, radius, depth, at=(0, 0, 0), rot=(0, 0, 0), segments=24, top=None, scale=(1, 1), bone="body"):
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
        verts = made["verts"]
        # Hard rims: the caps are flat.
        for edge in {e for v in verts for e in v.link_edges}:
            if len(edge.link_faces) == 2 and edge.link_faces[0].normal.angle(edge.link_faces[1].normal, 0) > 0.8:
                edge.smooth = False
        return self._take(verts, colour, bone)

    def torus(self, colour, major, minor, at=(0, 0, 0), rot=(0, 0, 0), segments=28, sides=10, scale=(1, 1, 1), bone="body"):
        matrix = transform(at, rot, scale)
        rings = []
        for i in range(segments):
            u = 2 * math.pi * i / segments
            ring = []
            for j in range(sides):
                v = 2 * math.pi * j / sides
                point = Vector(((major + minor * math.cos(v)) * math.cos(u), (major + minor * math.cos(v)) * math.sin(u), minor * math.sin(v)))
                ring.append(self.bm.verts.new(matrix @ point))
            rings.append(ring)
        for i in range(segments):
            for j in range(sides):
                a, b = rings[i], rings[(i + 1) % segments]
                self.bm.faces.new((a[j], b[j], b[(j + 1) % sides], a[(j + 1) % sides]))
        return self._take([v for ring in rings for v in ring], colour, bone)

    def rod(self, colour, a, b, radius, segments=10, bone="body"):
        """A thin cylinder from point a to point b."""
        a, b = Vector(a), Vector(b)
        direction = b - a
        rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
        made = bmesh.ops.create_cone(
            self.bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=direction.length, matrix=Matrix.Translation((a + b) / 2) @ rotation
        )
        return self._take(made["verts"], colour, bone)

    def slab(self, colour, rows, thickness, at=(0, 0, 0), rot=(0, 0, 0), bone="body"):
        """
        A flat shape in the XZ plane given `thickness` along y, from `rows`: (z, x_left, x_right) bottom to top, so it
        can bend along its height. Its front faces -y.
        """
        matrix = transform(at, rot)
        front = [(self.bm.verts.new(matrix @ Vector((l, -thickness / 2, z))), self.bm.verts.new(matrix @ Vector((r, -thickness / 2, z)))) for z, l, r in rows]
        back = [(self.bm.verts.new(matrix @ Vector((l, thickness / 2, z))), self.bm.verts.new(matrix @ Vector((r, thickness / 2, z)))) for z, l, r in rows]
        faces = []
        for i in range(len(rows) - 1):
            (fl0, fr0), (fl1, fr1) = front[i], front[i + 1]
            (bl0, br0), (bl1, br1) = back[i], back[i + 1]
            faces += [
                self.bm.faces.new((fl0, fr0, fr1, fl1)),
                self.bm.faces.new((br0, bl0, bl1, br1)),
                self.bm.faces.new((bl0, fl0, fl1, bl1)),
                self.bm.faces.new((fr0, br0, br1, fr1)),
            ]
        faces.append(self.bm.faces.new((front[0][0], back[0][0], back[0][1], front[0][1])))
        faces.append(self.bm.faces.new((front[-1][1], back[-1][1], back[-1][0], front[-1][0])))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        return self._take([v for pair in front + back for v in pair], colour, bone)

    def prism(self, colour, points, thickness, at=(0, 0, 0), rot=(0, 0, 0), bone="body"):
        """A flat shape from (x, z) `points` (anticlockwise seen from the front), given `thickness` along y."""
        matrix = transform(at, rot)
        front = [self.bm.verts.new(matrix @ Vector((x, -thickness / 2, z))) for x, z in points]
        back = [self.bm.verts.new(matrix @ Vector((x, thickness / 2, z))) for x, z in points]
        faces = [self.bm.faces.new(front), self.bm.faces.new(list(reversed(back)))]
        for i in range(len(points)):
            j = (i + 1) % len(points)
            faces.append(self.bm.faces.new((front[j], front[i], back[i], back[j])))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        for face in faces:
            face.smooth = False
        verts = self._take(front + back, colour, bone)
        for face in faces:
            face.smooth = False
        return verts

    def finish(self, collection, armature, smooth_by_area=True):
        mesh = bpy.data.meshes.new(self.name)
        bmesh.ops.scale(self.bm, vec=(SCALE, SCALE, SCALE), verts=list(self.bm.verts))
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for colour in self.colours:
            mesh.materials.append(material(colour))
        made = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(made)
        for bone in self.bones:
            made.vertex_groups.new(name=bone)
        if smooth_by_area:
            # Flat faces stay flat and the rounded edges between them shade smoothly: weighted by face area.
            weighted = made.modifiers.new("weighted", "WEIGHTED_NORMAL")
            weighted.mode = "FACE_AREA"
            weighted.weight = 50
            weighted.keep_sharp = True
            with bpy.context.temp_override(object=made, active_object=made, selected_objects=[made]):
                bpy.ops.object.modifier_apply(modifier=weighted.name)
        made.parent = armature
        rig = made.modifiers.new("rig", "ARMATURE")
        rig.object = armature
        return made


# --- The figure -----------------------------------------------------------------------------------------------------


def body(p):
    """The body, the arms and the legs: the block of orange that is Clawd, standing on its four legs."""
    p.rounded_box("clawd", (W, D, H), at=(0, 0, L + H / 2), radius=ROUND, segments=4)
    for side, bone in ((1, "arm_left"), (-1, "arm_right")):
        p.rounded_box("clawd", (ARM["out"] + 0.06, ARM["depth"], ARM["height"]), at=(side * (W / 2 + ARM["out"] / 2 - 0.03), 0, ARM["z"]), radius=0.035, bone=bone)
    for x, bone in leg_bones():
        # Each leg reaches up into the body, so no gap opens as the body bobs or tilts.
        p.rounded_box("clawd", (LEG["width"], LEG["depth"], L + 0.1), at=(x, 0, (L + 0.1) / 2), radius=0.03, bone=bone)


def leg_bones():
    """Each leg's bone and where it stands across the body, the figure's left (+x) first."""
    outer, inner = LEG["xs"]
    return [(outer, "leg_left_outer"), (inner, "leg_left_inner"), (-inner, "leg_right_inner"), (-outer, "leg_right_outer")]


def eye_rows(height, width, rows=13):
    """An eye's outline from bottom to top, as (z, left, right) about its middle: a tall rectangle, its corners rounded."""
    out = []
    corner = width * 0.32
    for i in range(rows):
        z = -height / 2 + height * i / (rows - 1)
        # How far into a corner's curve this row is, from its top or bottom end.
        into = max(0.0, abs(z) - (height / 2 - corner))
        half = width / 2 - corner + math.sqrt(max(corner * corner - into * into, 0.0))
        out.append((z, -half, half))
    return out


def eyes(p):
    """The eyes: tall and black, a little proud of the face, each with a glint of light."""
    for side in (1, -1):
        p.slab("ink:gloss", eye_rows(EYE["height"], EYE["width"]), EYE["proud"] * 2, at=(side * EYE["x"], FRONT, EYE["z"]))
        # The glint: a small square high on the eye, on the side away from the nose.
        g = 0.024
        gx, gz = side * EYE["x"] + side * 0.012, EYE["z"] + EYE["height"] / 2 - 0.045
        p.prism("white:gloss", [(-g / 2, -g / 2), (g / 2, -g / 2), (g / 2, g / 2), (-g / 2, g / 2)], 0.004, at=(gx, FRONT - EYE["proud"] - 0.002, gz))


def eye_shape(co, kind):
    """Where an eye's vertex goes for an expression: `co` is in the figure's frame, the eye found by its side."""
    side = 1 if co.x > 0 else -1
    cx, cz = side * EYE["x"], EYE["z"]
    dx, dz = co.x - cx, co.z - cz
    half = EYE["height"] / 2
    if kind == "blink":
        return Vector((cx + dx * 1.15, co.y, cz - 0.02 + dz * 0.1))
    if kind == "puzzled":
        # The left eye opens wide and lifts; the right squints.
        if side > 0:
            return Vector((cx + dx * 1.05, co.y, cz + 0.016 + dz * 1.12))
        return Vector((cx + dx * 1.1, co.y, cz - 0.02 + dz * 0.42))
    if kind == "strained":
        # Squeezed shut, each eye a chevron pointing at the nose: > <.
        t = max(-1.0, min(1.0, dz / half))
        towards_nose = -side
        return Vector((cx + dx * 0.9 + towards_nose * (0.048 * (1 - abs(t)) - 0.016), co.y, cz - 0.01 + dz * 0.6))
    raise ValueError(kind)


def add_eye_shapes(eyes_object):
    eyes_object.shape_key_add(name="Basis")
    mesh = eyes_object.data
    glints = {i for i, v in enumerate(mesh.vertices) if v.co.y / SCALE < FRONT - EYE["proud"] - 0.0005}
    for kind in ("blink", "puzzled", "strained"):
        key = eyes_object.shape_key_add(name=kind, from_mix=False)
        for i, v in enumerate(mesh.vertices):
            # The shapes are worked out at the size the figure is modelled, then built as big as it stands.
            co = v.co / SCALE
            moved = eye_shape(co, kind)
            if i in glints and kind in ("blink", "strained"):
                # The glint goes as the eye shuts: drawn in to its eye's middle, behind it.
                side = 1 if co.x > 0 else -1
                moved = Vector((side * EYE["x"], co.y + 0.022, EYE["z"] - 0.01))
            key.data[i].co = moved * SCALE


# --- What people wear ---------------------------------------------------------------------------------------------


def hat_beanie(p):
    """A knitted beanie with a turned-up band and a bobble."""
    p.uv_ball("accent", 0.22, at=(0, 0, TOP + 0.03), scale=(1.12, 1.0, 1.15), top_only=True, segments=24, rings=14)
    # The turned-up band: a fat roll of knit round the bottom.
    p.torus("accent", 0.225, 0.045, at=(0, 0, TOP + 0.035), scale=(1.12, 1.0, 1.0), segments=32, sides=12)
    p.ball("white", 0.075, at=(0, 0, TOP + 0.3), subdivisions=3)


def hat_cap(p):
    """A baseball cap, its peak to the front."""
    p.uv_ball("accent", 0.24, at=(0, 0.01, TOP - 0.01), scale=(1.05, 1.0, 0.72), top_only=True)
    p.cylinder("accent", 0.17, 0.018, at=(0, -0.24, TOP + 0.005), rot=(-0.12, 0, 0), scale=(1.15, 0.9))
    p.cylinder("accent", 0.02, 0.02, at=(0, 0.01, TOP + 0.175))


def hat_beret(p):
    """A beret, worn at a tilt."""
    p.uv_ball("accent", 0.27, at=(0.05, 0.0, TOP + 0.03), scale=(1.0, 0.92, 0.32), rot=(0, 0.16, 0))
    p.cylinder("accent", 0.012, 0.04, at=(0.05, 0.0, TOP + 0.13))


def hat_top_hat(p):
    """A little top hat with a band in the look's colour."""
    p.cylinder("ink", 0.27, 0.022, at=(0, 0, TOP + 0.011))
    p.cylinder("ink", 0.17, 0.28, at=(0, 0, TOP + 0.16), top=0.18)
    p.cylinder("accent", 0.174, 0.05, at=(0, 0, TOP + 0.05))


def hat_sun_hat(p):
    """A straw sun hat, wide in the brim, with a ribbon round it."""
    p.cylinder("sand", 0.44, 0.02, at=(0, 0, TOP + 0.02), top=0.4, segments=36)
    p.uv_ball("sand", 0.2, at=(0, 0, TOP + 0.02), scale=(1, 1, 0.75), top_only=True)
    p.cylinder("accent", 0.205, 0.04, at=(0, 0, TOP + 0.045))


def hat_bow(p):
    """A big ribbon bow, tied on top a little to one side and tipped forward so it shows from the front."""
    x, y, z = 0.2, -0.08, TOP + 0.075
    tip = (-0.5, 0, 0)
    p.ball("accent", 0.05, at=(x, y, z), scale=(1, 0.8, 1), subdivisions=3)
    for side in (1, -1):
        p.uv_ball("accent", 0.13, at=(x + side * 0.13, y, z + 0.02), scale=(1.0, 0.4, 0.62), rot=(tip[0], side * 0.3, 0))
        p.rounded_box("accent", (0.06, 0.025, 0.14), at=(x + side * 0.05, y - 0.02, z - 0.07), rot=(0, side * 0.45, 0), radius=0.01)


def hat_flower(p):
    """A flower tucked on top near the front corner, facing out, with two leaves."""
    x, y, z = 0.28, -0.16, TOP + 0.085
    face = Euler((-1.1, 0, 0.35)).to_matrix()
    for k in range(6):
        a = 2 * math.pi * k / 6
        at = Vector((x, y, z)) + face @ Vector((0.07 * math.cos(a), 0.07 * math.sin(a), 0))
        p.ball("accent", 0.055, at=tuple(at), scale=(1.3, 1.3, 0.4), rot=(-1.1, 0, 0.35), subdivisions=2)
    p.ball("mustard", 0.042, at=tuple(Vector((x, y, z)) + face @ Vector((0, 0, 0.018))), scale=(1, 1, 0.7), rot=(-1.1, 0, 0.35), subdivisions=2)
    for lean in (0.9, -0.5):
        p.ball("leaf", 0.06, at=(x - 0.06 + 0.06 * lean, y + 0.05, TOP + 0.015), scale=(1.7, 0.75, 0.25), rot=(0, 0, lean))


def hat_party_hat(p):
    """A party hat: a striped cone with a bobble."""
    p.cylinder("accent", 0.13, 0.3, at=(-0.06, 0, TOP + 0.15), top=0.008, rot=(0, -0.12, 0))
    p.torus("white", 0.125, 0.018, at=(-0.06, 0, TOP + 0.015), rot=(0, -0.12, 0))
    p.ball("white", 0.045, at=(-0.06 - 0.3 * math.sin(0.12), 0, TOP + 0.3))


def eyewear_round_glasses(p):
    """Round glasses with dark frames, no glass in them to hide the eyes."""
    y = FRONT - 0.035
    for side in (1, -1):
        p.torus("ink", 0.105, 0.011, at=(side * EYE["x"], y, EYE["z"]), rot=(math.pi / 2, 0, 0))
        temple(p, side, y)
    p.rod("ink", (-EYE["x"] + 0.105, y, EYE["z"] + 0.02), (EYE["x"] - 0.105, y, EYE["z"] + 0.02), 0.009)


def temple(p, side, y, colour="ink"):
    """A glasses arm from the frame's outer edge, round the body's corner and back along its side."""
    start = Vector((side * (EYE["x"] + 0.105), y, EYE["z"] + 0.03))
    corner = Vector((side * (W / 2 + 0.012), FRONT + 0.02, EYE["z"] + 0.03))
    p.rod(colour, start, corner, 0.008)
    p.rod(colour, corner, (side * (W / 2 + 0.012), 0.05, EYE["z"] + 0.03), 0.008)


def eyewear_square_glasses(p):
    """Square glasses with thick frames in the look's colour."""
    y = FRONT - 0.035
    w, h, t = 0.19, 0.25, 0.022
    for side in (1, -1):
        x = side * EYE["x"]
        for dz in (h / 2, -h / 2):
            p.rounded_box("accent", (w + t, t, t), at=(x, y, EYE["z"] + dz), radius=0.008)
        for dx in (w / 2, -w / 2):
            p.rounded_box("accent", (t, t, h), at=(x + dx, y, EYE["z"]), radius=0.008)
        temple(p, side, y, "accent")
    p.rounded_box("accent", (2 * EYE["x"] - 0.19, 0.016, 0.02), at=(0, y, EYE["z"] + 0.04), radius=0.006)


def eyewear_monocle(p):
    """A monocle over the left eye, on a gold chain."""
    y = FRONT - 0.035
    x = EYE["x"]
    p.torus("mustard", 0.11, 0.012, at=(x, y, EYE["z"]), rot=(math.pi / 2, 0, 0))
    links = 7
    for k in range(links):
        t = k / (links - 1)
        p.ball("mustard", 0.009, at=(x + 0.11 + 0.08 * t, y + 0.005, EYE["z"] - 0.02 - 0.2 * t + 0.08 * t * t), subdivisions=1)


def neckwear_scarf(p):
    """A thick knitted scarf wrapped round the body under the arms, its ends hanging at the front."""
    z0, z1 = L + 0.27 * H, L + 0.47 * H
    p.rounded_box("accent", (W + 0.07, D + 0.07, z1 - z0), at=(0, 0, (z0 + z1) / 2), radius=0.055, segments=4)
    # The knot, off to the right, and its two ends hanging from it.
    x, y = -0.2, FRONT - 0.07
    p.ball("accent", 0.08, at=(x, y + 0.01, (z0 + z1) / 2), scale=(1.15, 0.75, 0.95), subdivisions=3)
    p.rounded_box("accent", (0.15, 0.06, 0.26), at=(x - 0.03, y, z0 - 0.08), rot=(0, 0.14, 0), radius=0.025)
    p.rounded_box("accent", (0.14, 0.06, 0.2), at=(x + 0.1, y - 0.015, z0 - 0.05), rot=(0, -0.28, 0), radius=0.025)


def neckwear_bow_tie(p):
    """A bow tie, front and centre under the eyes."""
    z, y = L + 0.42 * H, FRONT - 0.03
    for side in (1, -1):
        p.prism("accent", [(0, -0.02), (side * 0.11, -0.06), (side * 0.11, 0.06), (0, 0.02)][:: side], 0.035, at=(0, y, z))
    p.rounded_box("accent", (0.05, 0.05, 0.05), at=(0, y - 0.01, z), radius=0.012)


def neckwear_tie(p):
    """A necktie hanging from under the eyes."""
    top, y = L + 0.46 * H, FRONT - 0.022
    p.rounded_box("accent", (0.07, 0.04, 0.06), at=(0, y - 0.006, top - 0.03), radius=0.012)
    p.prism("accent", [(-0.03, -0.06), (0.03, -0.06), (0.06, -0.2), (0, -0.25), (-0.06, -0.2)][::-1], 0.025, at=(0, y, top))


def neckwear_bandana(p):
    """A neckerchief: a triangle of cloth at the front, knotted at the side."""
    top, y = L + 0.42 * H, FRONT - 0.018
    p.prism("accent", [(-0.22, 0), (0.22, 0), (0, -0.2)][::-1], 0.02, at=(0, y, top))
    p.rounded_box("accent", (W + 0.03, D + 0.03, 0.04), at=(0, 0, top - 0.01), radius=0.015, segments=2)
    p.ball("accent", 0.04, at=(W / 2 + 0.02, -0.12, top - 0.01), scale=(0.8, 1, 1))


def apron(p):
    """What staff wear: a bib apron over the lower front, tied round the body, with a pocket."""
    y = FRONT - 0.012
    p.rounded_box("apron", (0.6, 0.02, 0.3), at=(0, y, L + 0.1), radius=0.01, segments=2)
    p.rounded_box("apron", (W + 0.025, D + 0.025, 0.035), at=(0, 0, L + 0.24), radius=0.012, segments=2)
    p.rounded_box("apron", (0.22, 0.02, 0.1), at=(0.12, y - 0.012, L + 0.08), radius=0.008, segments=2)


def sweat(p):
    """A drop of sweat on the brow, for when someone is struggling to follow."""
    x, z = -W / 2 + 0.1, TOP - 0.06
    p.ball("sky:gloss", 0.035, at=(x, FRONT - 0.02, z), scale=(1, 0.7, 1.15))
    p.cylinder("sky:gloss", 0.03, 0.05, at=(x, FRONT - 0.02, z + 0.04), top=0.002, scale=(1, 0.7))


PARTS = {
    "clawd-body": body,
    "eyes": eyes,
    "hat-beanie": hat_beanie,
    "hat-cap": hat_cap,
    "hat-beret": hat_beret,
    "hat-top-hat": hat_top_hat,
    "hat-sun-hat": hat_sun_hat,
    "hat-bow": hat_bow,
    "hat-flower": hat_flower,
    "hat-party-hat": hat_party_hat,
    "eyewear-round-glasses": eyewear_round_glasses,
    "eyewear-square-glasses": eyewear_square_glasses,
    "eyewear-monocle": eyewear_monocle,
    "neckwear-scarf": neckwear_scarf,
    "neckwear-bow-tie": neckwear_bow_tie,
    "neckwear-tie": neckwear_tie,
    "neckwear-bandana": neckwear_bandana,
    "apron": apron,
    "sweat": sweat,
}


# --- The rig --------------------------------------------------------------------------------------------------------


def rig(collection):
    """The armature: `root` on the ground, `body` from the body's foot, the arms at its sides and the legs below it."""
    data = bpy.data.armatures.new("clawd")
    armature = bpy.data.objects.new("clawd", data)
    collection.objects.link(armature)
    with bpy.context.temp_override(object=armature, active_object=armature, selected_objects=[armature], selected_editable_objects=[armature]):
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode="EDIT")
        bones = data.edit_bones

        def bone(name, head, tail, parent=None):
            made = bones.new(name)
            made.head, made.tail, made.roll = Vector(head) * SCALE, Vector(tail) * SCALE, 0
            made.parent = bones.get(parent) if parent else None
            return made

        bone("root", (0, 0, 0), (0, 0, 0.15))
        bone("body", (0, 0, L), (0, 0, TOP), "root")
        for side, name in ((1, "arm_left"), (-1, "arm_right")):
            bone(name, (side * (W / 2 - 0.02), 0, ARM["z"]), (side * (W / 2 - 0.02), 0, ARM["z"] + 0.12), "body")
        for x, name in leg_bones():
            bone(name, (x, 0, L + 0.02), (x, 0, 0.02), "root")
        bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    return armature


# --- The clips ------------------------------------------------------------------------------------------------------


class Keys:
    """
    Keyframes for one action, given in the figure's own axes: turns in radians about x (pitch, + tips the top forward,
    to -y), y (roll, + tips the top towards the figure's right, -x) and z (turn), moves in metres, and scale along each
    axis. Each bone's own axes are worked out from its rest pose.
    """

    def __init__(self, armature, name, frames):
        self.armature = armature
        self.frames = frames
        self.action = bpy.data.actions.new(name)
        self.action.use_fake_user = True
        armature.animation_data_create()
        armature.animation_data.action = self.action
        for pose_bone in armature.pose.bones:
            pose_bone.rotation_mode = "QUATERNION"

    def key(self, bone, frame, turn=(0, 0, 0), move=(0, 0, 0), scale=(1, 1, 1)):
        pose_bone = self.armature.pose.bones[bone]
        rest = pose_bone.bone.matrix_local.to_3x3()
        to_bone = rest.inverted()
        world_turn = Euler(turn, "XYZ").to_matrix()
        pose_bone.rotation_quaternion = (to_bone @ world_turn @ rest).to_quaternion()
        pose_bone.location = to_bone @ (Vector(move) * SCALE)
        scaled = to_bone @ Matrix.Diagonal(scale) @ rest
        pose_bone.scale = (abs(scaled[0][0]), abs(scaled[1][1]), abs(scaled[2][2]))
        for path in ("rotation_quaternion", "location", "scale"):
            pose_bone.keyframe_insert(path, frame=frame)

    def every(self, bone, samples, at):
        """Keys `bone` at `samples` evenly spaced frames over the loop (the last the same as the first), from `at(t)` with t in [0, 1)."""
        for k in range(samples + 1):
            t = (k % samples) / samples
            self.key(bone, 1 + self.frames * k / samples, **at(t))

    def done(self):
        for fcurve in action_fcurves(self.action):
            for point in fcurve.keyframe_points:
                point.interpolation = "BEZIER"
                point.handle_left_type = point.handle_right_type = "AUTO_CLAMPED"
            fcurve.update()
        self.armature.animation_data.action = None
        return self.action


def action_fcurves(action):
    """An action's curves: on its layers' strips in 4.4 and later, or on the action itself before."""
    if hasattr(action, "layers") and action.layers:
        return [fcurve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fcurve in bag.fcurves]
    return list(action.fcurves)


TAU = 2 * math.pi
LEGS = [name for _, name in leg_bones()]


def flap(arm, up, forward=0.0):
    """An arm's turn: raised `up` (radians) about the front-to-back axis, and swung `forward` about the upright one."""
    side = 1 if arm == "arm_left" else -1
    # Turning about +y lowers the left arm (+x) and raises the right; about +z swings the left arm back (to +y).
    return (0, -side * up, -side * forward)


def still_legs(keys, samples=4):
    for name in LEGS:
        keys.every(name, samples, lambda t: {})


def idle(armature):
    """Standing: breathing in and out (a soft squash and stretch), arms swaying a little, now and then a lean."""
    keys = Keys(armature, "idle", 72)
    keys.every(
        "body",
        12,
        lambda t: {
            "scale": (1 + 0.012 * math.sin(TAU * t), 1 + 0.012 * math.sin(TAU * t), 1 - 0.022 * math.sin(TAU * t)),
            "turn": (0, 0.02 * math.sin(TAU * t + 1.0), 0),
        },
    )
    keys.every("arm_left", 12, lambda t: {"turn": flap("arm_left", 0.08 * math.sin(TAU * t + 0.6))})
    keys.every("arm_right", 12, lambda t: {"turn": flap("arm_right", 0.08 * math.sin(TAU * t + 0.2))})
    keys.every("root", 4, lambda t: {})
    still_legs(keys)
    return keys.done()


# The walk: a quick scuttle. One loop is two steps, each pair of legs (an outer and the other side's inner) swinging
# forward while the other pushes back. How far the body travels in one loop sets how fast it walks at its own pace.
WALK = {"frames": 12, "swing": 0.62, "lift": 0.05}
WALK_STRIDE = 2 * 2 * (L + 0.02) * math.sin(WALK["swing"])
WALK_METRES_PER_SECOND = SCALE * WALK_STRIDE / (WALK["frames"] / FPS)


def walk(armature):
    """Walking: the legs scuttle in pairs, the body bobbing with each step and rocking side to side, arms swinging."""
    keys = Keys(armature, "walk", WALK["frames"])
    swing, lift = WALK["swing"], WALK["lift"]

    def leg(phase):
        def at(t):
            a = TAU * (t + phase)
            # Forward is -y: a leg swings forward (its foot to -y) as it lifts, and pushes back on the ground.
            return {"turn": (swing * math.cos(a), 0, 0), "move": (0, 0, lift * max(0.0, math.sin(a)))}

        return at

    for name, phase in zip(LEGS, (0, 0.5, 0, 0.5)):
        keys.every(name, 12, leg(phase))
    keys.every(
        "body",
        12,
        lambda t: {
            "move": (0, 0, 0.03 * abs(math.sin(TAU * t))),
            "turn": (0.07, 0.07 * math.sin(TAU * t), 0.04 * math.sin(TAU * t)),
            "scale": (1 - 0.02 * math.cos(2 * TAU * t), 1, 1 + 0.03 * math.cos(2 * TAU * t)),
        },
    )
    keys.every("arm_left", 12, lambda t: {"turn": flap("arm_left", 0.3 + 0.12 * math.sin(2 * TAU * t), 0.45 * math.cos(TAU * t))})
    keys.every("arm_right", 12, lambda t: {"turn": flap("arm_right", 0.3 + 0.12 * math.sin(2 * TAU * t), 0.45 * math.cos(TAU * t))})
    keys.every("root", 4, lambda t: {})
    return keys.done()


def talk(armature):
    """Talking: bouncing a little with the words, leaning in and out, the arms waving as they go."""
    keys = Keys(armature, "talk", 48)
    keys.every(
        "body",
        16,
        lambda t: {
            "move": (0, 0, 0.02 * abs(math.sin(2 * TAU * t))),
            "turn": (-0.05 * math.sin(TAU * t), 0.05 * math.sin(TAU * t + 0.8), 0.06 * math.sin(TAU * t)),
            "scale": (1 + 0.015 * math.sin(4 * TAU * t), 1, 1 - 0.025 * math.sin(4 * TAU * t)),
        },
    )
    keys.every("arm_left", 16, lambda t: {"turn": flap("arm_left", 0.6 * max(0.0, math.sin(TAU * t)) ** 1.5 + 0.12 * math.sin(4 * TAU * t))})
    keys.every("arm_right", 16, lambda t: {"turn": flap("arm_right", 0.1 + 0.16 * math.sin(2 * TAU * t + 1.2))})
    keys.every("root", 4, lambda t: {})
    still_legs(keys)
    return keys.done()


CLIPS = [idle, walk, talk]


# --- Building and exporting ------------------------------------------------------------------------------------------


def clear(collection):
    for made in list(collection.objects):
        data = made.data
        bpy.data.objects.remove(made)
        if data is not None and data.users == 0:
            (bpy.data.meshes if isinstance(data, bpy.types.Mesh) else bpy.data.armatures).remove(data)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def build():
    collection = bpy.data.collections.get("clawd")
    if collection is None:
        collection = bpy.data.collections.new("clawd")
        bpy.context.scene.collection.children.link(collection)
    clear(collection)
    bpy.context.scene.render.fps = FPS
    armature = rig(collection)
    made = {}
    for name, put_together in PARTS.items():
        part = Part(name)
        put_together(part)
        made[name] = part.finish(collection, armature, smooth_by_area=name != "eyes")
    add_eye_shapes(made["eyes"])
    for clip in CLIPS:
        clip(armature)
    return armature, made


def export(armature):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    for other in bpy.context.scene.objects:
        other.select_set(False)
    for child in [armature, *armature.children]:
        child.hide_set(False)
        child.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=False,
        export_morph=True,
        export_morph_normal=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
        export_reset_pose_bones=True,
        export_optimize_animation_size=True,
    )


if __name__ == "__main__" or "__file__" not in globals():
    figure, parts = build()
    export(figure)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "clawd.blend"))
    result = {"parts": {name: [round(v, 3) for v in part.dimensions] for name, part in parts.items()}, "walk_speed": WALK_METRES_PER_SECOND}
    print(result)
