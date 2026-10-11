import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, SphereGeometry, Vector3, type Group, type Points } from 'three';
import { WORLD_COLOURS, type WorldColour } from './palette.ts';

/**
 * How the sky looks at this moment, in linear colours and directions: `Lighting` blends it from the time of day's
 * presets each frame, and `Sky` draws it.
 */
export type SkyLook = {
  /** Overhead, and along the horizon. */
  zenith: Color;
  horizon: Color;
  /** Below the horizon: the haze that the far land, hills and mountains fade into. */
  haze: Color;
  /** Sunrise or sunset: the glow along the horizon, strongest towards the sun, and how much of it shows (0 to 1). */
  twilight: Color;
  twilightAmount: number;
  /** Towards the sun and the moon, from the camera. */
  sunDirection: Vector3;
  moonDirection: Vector3;
  /** The sun's disc, the glow round it and how strong that glow is. */
  sunDisc: Color;
  sunGlow: Color;
  glow: number;
  /** How much of the moon (with its halo) and the stars show, from 0 to 1. */
  moon: number;
  stars: number;
};

export function createSkyLook(): SkyLook {
  return {
    zenith: new Color(),
    horizon: new Color(),
    haze: new Color(),
    twilight: new Color(),
    twilightAmount: 0,
    sunDirection: new Vector3(0, 1, 0),
    moonDirection: new Vector3(0, -1, 0),
    sunDisc: new Color(),
    sunGlow: new Color(),
    glow: 0,
    moon: 0,
    stars: 0,
  };
}

/** How far off the sky is drawn, round the camera: inside its far plane (1000 m), and past everything in the town. */
const SKY_RADIUS = 900;
/** The stars, just inside the sky, so the hills and mountains stand in front of them. */
const STAR_RADIUS = 850;
/**
 * The sun's and the moon's discs, as angles from their middles to their edges, in radians: drawn bigger than life, so
 * they read on screen. The moon's face is a little darker in its seas.
 */
const DISCS = { sun: 0.03, moon: 0.034 } as const;
const MOON: { light: WorldColour; seas: WorldColour; halo: WorldColour } = { light: 'cream', seas: 'linen', halo: 'moonlight' };
/** How many stars, and their colours: mostly white, some warmer and some cooler. */
const STARS = { count: 1100, colours: ['white', 'white', 'white', 'butter', 'moonlight'] as WorldColour[] } as const;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 haze;
  uniform vec3 twilight;
  uniform float twilightAmount;
  uniform vec3 sunDirection;
  uniform vec3 moonDirection;
  uniform vec3 sunDisc;
  uniform vec3 sunGlow;
  uniform float glow;
  uniform float moon;
  uniform vec3 moonLight;
  uniform vec3 moonSeas;
  uniform vec3 moonHalo;
  varying vec3 vDirection;

  // How much of a disc of this angular radius, round this direction, covers this pixel: edges smoothed over a pixel.
  float disc(vec3 d, vec3 towards, float radius) {
    float angle = acos(clamp(dot(d, towards), -1.0, 1.0));
    float pixel = max(fwidth(angle), 1e-5);
    return 1.0 - smoothstep(radius - pixel, radius + pixel, angle);
  }

  void main() {
    vec3 d = normalize(vDirection);
    float up = d.y;
    // Below the horizon there's only haze, which the far land has faded into by the time it gets there.
    float aboveHorizon = smoothstep(-0.002, 0.002, up);
    float height = max(up, 0.0);

    // Pale along the horizon, deepening overhead.
    vec3 colour = mix(horizon, zenith, pow(height, 0.55));

    // Sunrise and sunset: a glow along the horizon, all round but strongest towards the sun.
    vec2 flatSun = normalize(sunDirection.xz + vec2(1e-5));
    vec2 flatHere = normalize(d.xz + vec2(1e-5));
    float towardsSun = dot(flatSun, flatHere) * 0.5 + 0.5;
    float band = exp(-height * 7.0);
    colour = mix(colour, twilight, twilightAmount * band * (0.25 + 0.75 * towardsSun * towardsSun));

    // The glow round the sun: wide and faint, and close and bright.
    float toSun = max(dot(d, sunDirection), 0.0);
    colour = mix(colour, sunGlow, clamp(glow * (0.5 * pow(toSun, 10.0) + 0.5 * pow(toSun, 120.0)), 0.0, 1.0));

    // The moon's halo, and its face, with darker seas on it.
    float toMoon = max(dot(d, moonDirection), 0.0);
    colour = mix(colour, moonHalo, moon * 0.35 * pow(toMoon, 300.0));
    vec3 across = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)));
    vec3 upward = cross(across, moonDirection);
    vec2 onFace = vec2(dot(d, across), dot(d, upward)) / sin(${DISCS.moon.toFixed(4)});
    float seas = smoothstep(0.42, 0.18, length(onFace - vec2(-0.22, 0.25)))
      + smoothstep(0.32, 0.12, length(onFace - vec2(0.3, -0.05)))
      + smoothstep(0.26, 0.08, length(onFace - vec2(-0.05, -0.42)));
    vec3 face = mix(moonLight, moonSeas, clamp(seas, 0.0, 1.0) * 0.8);
    colour = mix(colour, face, moon * disc(d, moonDirection, ${DISCS.moon.toFixed(4)}));

    // The sun's disc, in front of all.
    colour = mix(colour, sunDisc, disc(d, sunDirection, ${DISCS.sun.toFixed(4)}));

    gl_FragColor = vec4(mix(haze, colour, aboveHorizon), 1.0);
    #include <colorspace_fragment>
  }
`;

const STAR_VERTEX = /* glsl */ `
  uniform float time;
  uniform float pixelRatio;
  attribute float size;
  attribute float phase;
  attribute vec3 colour;
  varying vec3 vColour;
  varying float vShine;
  void main() {
    vColour = colour;
    // Each star twinkles at its own pace, and fades into the haze near the horizon.
    vShine = (0.75 + 0.25 * sin(time * (1.5 + phase) + phase * 6.2832)) * smoothstep(0.03, 0.3, normalize(position).y);
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float stars;
  varying vec3 vColour;
  varying float vShine;
  void main() {
    float fromMiddle = length(gl_PointCoord - 0.5) * 2.0;
    float shine = stars * vShine * (1.0 - smoothstep(0.2, 1.0, fromMiddle));
    gl_FragColor = vec4(vColour * shine, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A small seeded random number generator, so the stars are in the same places every night. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Stars scattered over the sky above the horizon, each with its size, colour and pace of twinkling. */
function starField() {
  const random = seeded(7);
  const [positions, sizes, phases, colours]: [number[], number[], number[], number[]] = [[], [], [], []];
  const colour = new Color();
  while (sizes.length < STARS.count) {
    // Evenly over the sphere, keeping those above the horizon.
    const y = random() * 2 - 1;
    const turn = random() * Math.PI * 2;
    if (y < 0.02) continue;
    const across = Math.sqrt(1 - y * y);
    positions.push(Math.cos(turn) * across * STAR_RADIUS, y * STAR_RADIUS, Math.sin(turn) * across * STAR_RADIUS);
    // Mostly faint and small, a few bright.
    const brightness = random() ** 3;
    sizes.push(1.2 + brightness * 2.6);
    phases.push(random());
    colour.set(WORLD_COLOURS[STARS.colours[Math.floor(random() * STARS.colours.length)]!]).multiplyScalar(0.35 + 0.65 * brightness);
    colours.push(colour.r, colour.g, colour.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new Float32BufferAttribute(phases, 1));
  geometry.setAttribute('colour', new Float32BufferAttribute(colours, 3));
  return geometry;
}

/**
 * The sky round the camera, past everything else: a gradient from the horizon up, the glow of sunrise and sunset, the
 * sun and the moon, and the stars at night, all as `look` says. Drawn first and behind everything, writing no depth.
 */
export function Sky({ look }: { look: SkyLook }) {
  const group = useRef<Group>(null);
  const starPoints = useRef<Points>(null);
  const { dome, sky, stars, starMaterial } = useMemo(() => {
    const sky = new ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        zenith: { value: look.zenith },
        horizon: { value: look.horizon },
        haze: { value: look.haze },
        twilight: { value: look.twilight },
        twilightAmount: { value: 0 },
        sunDirection: { value: look.sunDirection },
        moonDirection: { value: look.moonDirection },
        sunDisc: { value: look.sunDisc },
        sunGlow: { value: look.sunGlow },
        glow: { value: 0 },
        moon: { value: 0 },
        moonLight: { value: new Color(WORLD_COLOURS[MOON.light]) },
        moonSeas: { value: new Color(WORLD_COLOURS[MOON.seas]) },
        moonHalo: { value: new Color(WORLD_COLOURS[MOON.halo]) },
      },
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const starMaterial = new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { stars: { value: 0 }, time: { value: 0 }, pixelRatio: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    return { dome: new SphereGeometry(1, 48, 24), sky, stars: starField(), starMaterial };
  }, [look]);

  useFrame(({ camera, clock, gl }) => {
    group.current!.position.copy(camera.position);
    sky.uniforms.twilightAmount!.value = look.twilightAmount;
    sky.uniforms.glow!.value = look.glow;
    sky.uniforms.moon!.value = look.moon;
    starPoints.current!.visible = look.stars > 0;
    starMaterial.uniforms.stars!.value = look.stars;
    starMaterial.uniforms.time!.value = clock.elapsedTime;
    starMaterial.uniforms.pixelRatio!.value = gl.getPixelRatio();
  });

  return (
    <group ref={group}>
      <mesh geometry={dome} material={sky} scale={SKY_RADIUS} renderOrder={-1} frustumCulled={false} />
      <points ref={starPoints} geometry={stars} material={starMaterial} frustumCulled={false} />
    </group>
  );
}
