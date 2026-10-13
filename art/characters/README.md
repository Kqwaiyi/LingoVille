# Clawd, as everyone in town

Everyone in town, the Character and every NPC, is Clawd, the Claude Code mascot. `clawd.py` models it, rigs it, dresses it and animates it in code, in Blender, and exports the game's character art, `public/characters/clawd.glb`, which the game loads as it is.

- The shape follows the mascot as Claude Code's welcome screen draws it (its orange is `CLAWD_PALETTE.clawd` in `src/world/palette.ts`, `#d77757`): a block of orange about twice as wide as it is tall, two tall black eyes a quarter of the way in from each side, a stubby arm on each side level with the eyes, and four short legs below, two at each end. In 3D it's a little deeper and taller than the sprite, with soft edges, glossy eyes with a glint, and big enough (`SCALE`) to see over the shops' counters.
- The rig: `root` on the ground, `body` from the foot of the body (everything on it, the eyes and whatever is worn, is skinned to it), an arm bone each side and a bone for each leg. The game turns `body` for an expression's tilt and nod, on top of the clip.
- The eyes have shape keys the game eases between: `blink`, `puzzled` (one eye wide, the other squinting) and `strained` (squeezed shut, > <).
- What tells people apart: hats (`hat-*`), eyewear (`eyewear-*`, never with glass that hides the eyes) and neckwear (`neckwear-*`), one mesh each, which the game shows or hides; staff wear the `apron`, and `sweat` shows while someone is strained.
- Clips: `idle` (breathing, the arms swaying), `walk` (a scuttle, the legs in pairs) and `talk` (bouncing with the words, an arm waving).

**Rules**
- Change the figure in `clawd.py`, then rebuild: never edit `clawd.blend` or the GLB by hand, or the next rebuild loses it.
- It stands on the ground facing -Y (glTF's +z), in metres.
- Every material is named for its colour: a palette colour (`src/world/palette.ts`), with `:gloss` for a shiny finish, or `accent` and `apron`, which the game tints with a look's colour or a role's. No textures.
- A new hat, eyewear or neckwear needs its id in `src/content/appearance.ts`, its words in every language in `src/i18n`, and a part here named for it; `tooling/characterArt.test.ts` fails art that lacks a part, bone, eye shape or clip the game asks for (`src/world/characterArt.ts`), or a colour off the palette.

**Rebuilding** (Blender 5.x):

```
blender art/characters/clawd.blend --background --python art/characters/clawd.py
```

It rebuilds the figure in the scene's `clawd` collection, saves `clawd.blend` and exports `public/characters/clawd.glb`. With Blender open and its MCP add-on connected, `clawd.py` can be run in it as well, to look at the figure as it's built. Then look at the result in the running game (`npm run dev`) and run the Playwright smoke.
