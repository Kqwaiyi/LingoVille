import { Color, DataTexture, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping, TextureLoader, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { PALETTE, type PaletteColour } from './palette.ts';
import { parseMaterialName, SURFACE_LOOKS, surfaceTextureUrl, type Surface } from './surfaces.ts';
import type { Repaint } from './townArt.ts';

// How the town's materials are drawn: each a palette colour (`palette.ts`) made of a surface (`surfaces.ts`), lit
// physically. A textured surface's detail (`public/town/surfaces/`) is projected from the world onto each face from
// whichever of the three axes it faces most, blended where it turns, so it needs no texture coordinates and stays the
// same size on a stretched piece. Its colour is the palette's, shaded by the texture, mottled across metres so the
// repeats don't show, and grimier at the foot of a wall.

/** A texture's look before it's loaded: no tilt, and the colour as it is. */
const FLAT_DETAIL = (() => {
  const texture = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
})();

/** Seconds on the clock the water ripples and the leaves sway by. */
const waterTime = { value: 0 };

const loader = new TextureLoader();
const textures = new Map<Surface, Texture>();
/** A surface's detail texture, loaded once and shared by every colour of it. */
function detailTexture(surface: Surface, onLoad: (texture: Texture) => void) {
  const loaded = textures.get(surface);
  if (loaded) return onLoad(loaded);
  loader.load(surfaceTextureUrl(surface), (texture) => {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    textures.set(surface, texture);
    onLoad(texture);
  });
}

const DETAIL_VERTEX = /* glsl */ `
  #include <worldpos_vertex>
  vec4 surfaceWorld = vec4( transformed, 1.0 );
  vec3 surfaceObjectNormal = objectNormal;
  #ifdef USE_INSTANCING
    surfaceWorld = instanceMatrix * surfaceWorld;
    mat3 surfaceInstance = mat3( instanceMatrix );
    surfaceObjectNormal = surfaceInstance * ( surfaceObjectNormal / vec3( dot( surfaceInstance[ 0 ], surfaceInstance[ 0 ] ), dot( surfaceInstance[ 1 ], surfaceInstance[ 1 ] ), dot( surfaceInstance[ 2 ], surfaceInstance[ 2 ] ) ) );
  #endif
  vSurfacePosition = ( modelMatrix * surfaceWorld ).xyz;
  vSurfaceNormal = normalize( transpose( inverse( mat3( modelMatrix ) ) ) * surfaceObjectNormal );
`;

const DETAIL_COMMON = /* glsl */ `
  uniform sampler2D surfaceMap;
  uniform float surfaceScale;
  uniform float surfaceAlbedo;
  uniform float surfaceBump;
  uniform float surfaceMacro;
  uniform float surfaceGrime;
  varying vec3 vSurfacePosition;
  varying vec3 vSurfaceNormal;

  float surfaceHash( vec3 p ) {
    p = fract( p * 0.3183099 + 0.1 ) * 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  float surfaceNoise( vec3 x ) {
    vec3 i = floor( x );
    vec3 f = fract( x );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( mix( surfaceHash( i ), surfaceHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( surfaceHash( i + vec3( 0, 1, 0 ) ), surfaceHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
      mix( mix( surfaceHash( i + vec3( 0, 0, 1 ) ), surfaceHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( surfaceHash( i + vec3( 0, 1, 1 ) ), surfaceHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
      f.z
    );
  }
  vec3 surfaceTilt( vec3 texel ) {
    vec2 xy = ( texel.rg * 2.0 - 1.0 ) * surfaceBump;
    return vec3( xy, sqrt( max( 0.0, 1.0 - dot( xy, xy ) ) ) );
  }
`;

const DETAIL_SAMPLE = /* glsl */ `
  #include <map_fragment>
  // Projected from the three axes, blended by how squarely the face meets each (Golus's whiteout blend for the tilt).
  vec3 surfaceN = ( dot( vSurfaceNormal, vSurfaceNormal ) > 1e-12 ? normalize( vSurfaceNormal ) : vec3( 0.0, 1.0, 0.0 ) ) * ( gl_FrontFacing ? 1.0 : -1.0 );
  vec3 surfaceBlend = pow( abs( surfaceN ), vec3( 8.0 ) );
  surfaceBlend /= dot( surfaceBlend, vec3( 1.0 ) );
  vec3 surfaceSide = step( 0.0, surfaceN ) * 2.0 - 1.0;
  vec3 surfaceP = vSurfacePosition * surfaceScale;
  vec3 surfaceX = texture2D( surfaceMap, vec2( surfaceP.z * surfaceSide.x, surfaceP.y ) ).rgb;
  vec3 surfaceY = texture2D( surfaceMap, vec2( surfaceP.x * surfaceSide.y, surfaceP.z ) ).rgb;
  vec3 surfaceZ = texture2D( surfaceMap, vec2( -surfaceP.x * surfaceSide.z, surfaceP.y ) ).rgb;
  float surfaceShade = 1.0 + ( 2.0 * dot( vec3( surfaceX.b, surfaceY.b, surfaceZ.b ), surfaceBlend ) - 1.0 ) * surfaceAlbedo;
  float surfaceMottle = surfaceNoise( vSurfacePosition * 0.45 ) * 0.6 + surfaceNoise( vSurfacePosition * 0.11 + 7.0 ) * 0.4;
  surfaceShade *= 1.0 + ( surfaceMottle - 0.5 ) * 2.0 * surfaceMacro;
  surfaceShade *= 1.0 - surfaceGrime * ( 1.0 - smoothstep( 0.0, 0.9, vSurfacePosition.y ) ) * ( 1.0 - surfaceBlend.y );
  diffuseColor.rgb = min( diffuseColor.rgb * surfaceShade, vec3( 1.0 ) );
  vec3 tiltX = surfaceTilt( surfaceX );
  vec3 tiltY = surfaceTilt( surfaceY );
  vec3 tiltZ = surfaceTilt( surfaceZ );
  tiltX.x *= surfaceSide.x;
  tiltY.x *= surfaceSide.y;
  tiltZ.x *= -surfaceSide.z;
  tiltX = vec3( tiltX.xy + surfaceN.zy, abs( tiltX.z ) * surfaceN.x );
  tiltY = vec3( tiltY.xy + surfaceN.xz, abs( tiltY.z ) * surfaceN.y );
  tiltZ = vec3( tiltZ.xy + surfaceN.xy, abs( tiltZ.z ) * surfaceN.z );
  vec3 surfaceWorldNormal = normalize( tiltX.zyx * surfaceBlend.x + tiltY.xzy * surfaceBlend.y + tiltZ.xyz * surfaceBlend.z );
`;

/**
 * Leaves stirring in the breeze: each tree or shrub sways on its own beat, more the higher up it is, a few centimetres
 * at the top of a tree. (Their shadows hold still: too small a difference to see.)
 */
const SWAY_VERTEX = /* glsl */ `
  #include <begin_vertex>
  #ifdef USE_INSTANCING
    float swayPhase = dot( instanceMatrix[ 3 ].xz, vec2( 0.37, 0.71 ) );
  #else
    float swayPhase = dot( modelMatrix[ 3 ].xz, vec2( 0.37, 0.71 ) );
  #endif
  float swayReach = max( transformed.y - 0.6, 0.0 ) * 0.02;
  transformed.x += sin( swayTime * 1.1 + swayPhase + transformed.y * 0.9 ) * swayReach;
  transformed.z += cos( swayTime * 0.8 + swayPhase * 1.3 ) * swayReach * 0.7;
`;

/** Gives a material its surface's detail texture, projected from the world (see the top of this file). */
function withDetail(material: MeshStandardMaterial, surface: Surface) {
  const { texture, macro, grime } = SURFACE_LOOKS[surface];
  if (!texture) return material;
  const uniforms = {
    surfaceMap: { value: FLAT_DETAIL as Texture },
    surfaceScale: { value: 1 / texture.metres },
    surfaceAlbedo: { value: texture.albedo },
    surfaceBump: { value: texture.normal },
    surfaceMacro: { value: macro },
    surfaceGrime: { value: grime },
  };
  detailTexture(surface, (loaded) => (uniforms.surfaceMap.value = loaded));
  const sways = surface === 'foliage';
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms, { swayTime: waterTime });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePosition;\nvarying vec3 vSurfaceNormal;\nuniform float swayTime;')
      .replace('#include <begin_vertex>', sways ? SWAY_VERTEX : '#include <begin_vertex>')
      .replace('#include <worldpos_vertex>', DETAIL_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DETAIL_COMMON}`)
      .replace('#include <map_fragment>', DETAIL_SAMPLE)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor * ( 1.2 - 0.2 * surfaceShade ), 0.04, 1.0 );')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( ( viewMatrix * vec4( surfaceWorldNormal, 0.0 ) ).xyz );');
  };
  // Every surface shares one program (leaves another, that sways); only the uniforms differ.
  material.customProgramCacheKey = () => (sways ? 'town-surface-sway' : 'town-surface');
  return material;
}

/** The warm grey a faded colour goes towards, as light as the colour itself. */
const WEATHERED = new Color(PALETTE.sand);
const weatheredLightness = WEATHERED.r * 0.2126 + WEATHERED.g * 0.7152 + WEATHERED.b * 0.0722;

/** A palette colour chalked by the weather, this far towards a warm grey of its own lightness (in linear light). */
function faded(colour: PaletteColour, fade: number) {
  const paint = new Color(PALETTE[colour]);
  const lightness = paint.r * 0.2126 + paint.g * 0.7152 + paint.b * 0.0722;
  return paint.lerp(WEATHERED.clone().multiplyScalar(lightness / weatheredLightness), fade);
}

const materials = new Map<string, MeshStandardMaterial>();
/** One shared material per palette colour and surface, made once. */
export function townMaterial(colour: PaletteColour, surface: Surface = 'matte') {
  const key = `${colour}:${surface}`;
  if (!materials.has(key)) {
    const { roughness, metalness, fade } = SURFACE_LOOKS[surface];
    const material = new MeshStandardMaterial({ color: faded(colour, fade), roughness, metalness, name: key });
    materials.set(key, withDetail(material, surface));
  }
  return materials.get(key)!;
}

/** A material of the town art by its name (`colour:surface`), its colour swapped as `repaint` says. */
export function namedMaterial(name: string, repaint: Repaint = {}) {
  const parsed = parseMaterialName(name);
  if (!parsed) throw new Error(`The town art has a material named ${name}, which is no palette colour and surface.`);
  return townMaterial(repaint[parsed.colour] ?? parsed.colour, parsed.surface);
}

/**
 * Window glass: a dark pane that mirrors the sky while its place is open, darker still (blinds drawn) while it's closed.
 * Lit windows are lamplight.
 */
export const GLASS = {
  open: new MeshStandardMaterial({ color: PALETTE.charcoal, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6, emissive: new Color(PALETTE.lamplight), emissiveIntensity: 0.04 }),
  closed: new MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.18, metalness: 0.05, envMapIntensity: 0.9 }),
} as const;

/** Lit window glass and lit bulbs: lamplight that glows, brighter as night falls. */
export const LAMP = new MeshStandardMaterial({ color: PALETTE.lamplight, emissive: PALETTE.lamplight, roughness: 0.4 });

/** How brightly lit windows and bulbs glow, set by the time of day. */
export function setLampGlow(glow: number) {
  LAMP.emissiveIntensity = glow;
  roomGlow.value = glow * 0.6;
}

const WATER_NORMAL = /* glsl */ `
  #include <normal_fragment_maps>
  // Ripples: a few slow swells and a fine chop, crossing, tilting the surface as they pass.
  vec2 waterAt = vWaterPosition.xz;
  vec2 waterTilt = vec2( 0.0 );
  waterTilt += 0.05 * cos( dot( waterAt, vec2( 0.8, 0.6 ) ) * 1.3 + waterTime * 0.9 ) * vec2( 0.8, 0.6 );
  waterTilt += 0.04 * cos( dot( waterAt, vec2( -0.5, 0.86 ) ) * 2.1 + waterTime * 1.3 ) * vec2( -0.5, 0.86 );
  waterTilt += 0.025 * cos( dot( waterAt, vec2( 0.97, -0.26 ) ) * 4.7 + waterTime * 2.1 ) * vec2( 0.97, -0.26 );
  waterTilt += 0.018 * cos( dot( waterAt, vec2( 0.2, -0.98 ) ) * 7.3 + waterTime * 2.9 ) * vec2( 0.2, -0.98 );
  normal = normalize( ( viewMatrix * vec4( normalize( vec3( -waterTilt.x, 1.0, -waterTilt.y ) ), 0.0 ) ).xyz );
`;

/** Open water, the pond's and the canal's: dark and clear, mirroring the sky in its ripples. */
export const WATER = (() => {
  const material = new MeshStandardMaterial({ color: PALETTE.teal, roughness: 0.06, metalness: 0, envMapIntensity: 1.4, name: 'water' });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.waterTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPosition;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPosition;\nuniform float waterTime;')
      .replace('#include <normal_fragment_maps>', WATER_NORMAL);
  };
  return material;
})();

/** Moves the water's ripples on to this many seconds. */
export function setWaterTime(seconds: number) {
  waterTime.value = seconds;
}

const ROOM_VERTEX = /* glsl */ `
  #include <worldpos_vertex>
  mat4 roomModel = modelMatrix;
  #ifdef USE_INSTANCING
    roomModel = modelMatrix * instanceMatrix;
  #endif
  vRoomPoint = position;
  vRoomView = position - ( inverse( roomModel ) * vec4( cameraPosition, 1.0 ) ).xyz;
  vRoomSeed = fract( sin( dot( floor( roomModel[ 3 ].xyz * 2.0 ), vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
`;

const ROOM_FRAGMENT = /* glsl */ `
  #include <emissivemap_fragment>
  {
    // The room behind the glass: a box as wide and tall as the window, this deep, seen along the line of sight.
    vec2 roomHalf = ( roomBounds.yw - roomBounds.xz ) * 0.5;
    vec2 roomUv = ( vRoomPoint.xy - roomBounds.xz ) / ( roomBounds.yw - roomBounds.xz );
    vec3 from = vec3( ( roomUv * 2.0 - 1.0 ) * vec2( 1.0 / 1.6, 1.0 ), 0.0 );
    vec3 ray = vRoomView / vec3( roomHalf * vec2( 1.6, 1.0 ), roomDepth * 0.5 );
    float tx = ( ( ray.x > 0.0 ? 1.0 : -1.0 ) - from.x ) / ray.x;
    float ty = ( ( ray.y > 0.0 ? 1.0 : -1.0 ) - from.y ) / ray.y;
    float tz = ( -2.0 - from.z ) / min( ray.z, -1e-4 );
    float t = min( min( tx, ty ), tz );
    vec3 hit = from + ray * t;
    float seed = vRoomSeed;
    vec3 walls = mix( mix( roomCream, roomPeach, step( 0.4, seed ) ), roomSage, step( 0.75, seed ) );
    vec3 room = walls;
    if ( t == ty ) room = ray.y < 0.0 ? roomFloor * ( 0.8 + 0.2 * step( 0.5, fract( hit.x * 3.0 ) ) ) : roomCream * 1.1;
    else if ( t == tx ) room = walls * 0.82;
    else {
      // The back wall: a picture on it, or a shelf.
      vec2 frame = abs( hit.xy - vec2( seed - 0.5, 0.15 ) );
      if ( seed > 0.3 && frame.x < 0.28 && frame.y < 0.2 ) room = mix( roomFloor, roomCurtain, step( max( frame.x / 0.28, frame.y / 0.2 ), 0.8 ) );
    }
    // Lit by a lamp hanging in the middle of the ceiling, dimmer towards the back and the floor.
    vec3 lamp = vec3( 0.0, 0.85, -1.0 );
    float light = 1.4 / ( 1.0 + 1.6 * dot( hit - lamp, hit - lamp ) );
    room *= light;
    // Curtains drawn back either side, or half across, lit through from behind.
    float curtain = seed > 0.55 ? 0.2 + 0.15 * fract( seed * 7.0 ) : 0.0;
    float edge = min( roomUv.x, 1.0 - roomUv.x );
    if ( edge < curtain ) room = roomCurtain * ( 0.55 + 0.15 * sin( roomUv.x * 60.0 ) );
    totalEmissiveRadiance = room * roomGlow;
  }
`;

const roomGlow = { value: 1 };
/**
 * A lit window's glass at night, with a room behind it: a fake room (interior mapping) behind the pane of a
 * `wall-window` piece, its walls, floor, ceiling and a picture or curtains different from window to window, lit by a
 * lamp inside. The pane spans `bounds` (x from, x to, y from, y to, in the piece's own metres).
 */
function litRoom(bounds: readonly [number, number, number, number]) {
  const material = new MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.08, metalness: 0, envMapIntensity: 0.6, emissive: new Color(1, 1, 1), name: 'lit-room' });
  const colour = (name: PaletteColour) => ({ value: new Color(PALETTE[name]) });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, {
      roomGlow,
      roomBounds: { value: bounds },
      roomDepth: { value: 2.5 },
      roomCream: colour('lamplight'),
      roomPeach: colour('peach'),
      roomSage: colour('butter'),
      roomFloor: colour('walnut'),
      roomCurtain: colour('terracotta'),
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoomPoint;\nvarying vec3 vRoomView;\nvarying float vRoomSeed;')
      .replace('#include <worldpos_vertex>', ROOM_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vRoomPoint;\nvarying vec3 vRoomView;\nvarying float vRoomSeed;\nuniform float roomGlow;\nuniform vec4 roomBounds;\nuniform float roomDepth;\nuniform vec3 roomCream;\nuniform vec3 roomPeach;\nuniform vec3 roomSage;\nuniform vec3 roomFloor;\nuniform vec3 roomCurtain;',
      )
      .replace('#include <emissivemap_fragment>', ROOM_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'lit-room';
  return material;
}

/** The pane of a `wall-window` (`art/town/architecture.py`): 0.9 m wide, from 0.7 m to 1.9 m up. */
const WALL_WINDOW_ROOM = litRoom([-0.45, 0.45, 0.7, 1.9]);

/** Lit glass at night: a room behind it where the piece is a window in a wall, lamplight elsewhere. */
export const litGlass = (piece: string) => (piece === 'wall-window' ? WALL_WINDOW_ROOM : LAMP);
