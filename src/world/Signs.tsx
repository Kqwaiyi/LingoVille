import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { SIGN_IDS, worldSign, type SignId, type SignLine } from '../content/index.ts';
import { MOVEMENT } from '../sim/index.ts';
import { selectCulturePackId, selectScreen, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { SIGNS } from './town.ts';
import { PALETTE } from './palette.ts';

/** Pixels per metre of sign. */
const RESOLUTION = 256;
/** How long the tooltip waits after the pointer leaves a sign, so the pointer can reach the tooltip's Translate. */
const LEAVE_GRACE_MS = 400;
const INK = PALETTE.ink;
const BOARD = PALETTE.cream;
const FONT = 'system-ui, "Hiragino Sans", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", sans-serif';

/**
 * Paints a sign's lines onto a canvas: the first line as its heading, and any
 * note (a price or a time) right-aligned beside its line.
 */
function paintSign(lines: SignLine[], [width, height]: readonly [number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * RESOLUTION);
  canvas.height = Math.round(height * RESOLUTION);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BOARD;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  const pad = canvas.height * (lines.length === 1 ? 0.18 : 0.08);
  const rowHeight = (canvas.height - pad * 2) / (lines.length + (lines.length > 1 ? 0.4 : 0));
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  lines.forEach(({ text, note }, i) => {
    const heading = i === 0 && lines.length > 1;
    const size = rowHeight * (heading ? 0.85 : 0.62);
    const y = pad + rowHeight * (i + 0.5 + (i > 0 && lines.length > 1 ? 0.4 : 0));
    ctx.font = `${heading ? 'bold ' : ''}${Math.round(size)}px ${FONT}`;
    if (!note) {
      ctx.textAlign = lines.length === 1 || heading ? 'center' : 'left';
      ctx.fillText(text, ctx.textAlign === 'center' ? canvas.width / 2 : pad, y, canvas.width - pad * 2);
      return;
    }
    const noteWidth = ctx.measureText(note).width;
    ctx.textAlign = 'left';
    ctx.fillText(text, pad, y, canvas.width - pad * 3 - noteWidth);
    ctx.textAlign = 'right';
    ctx.fillText(note, canvas.width - pad, y);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * A sign painted from the Culture Pack. Pointing at it while the Character is
 * within range shows its tooltip (reading aid and Translate); walking out of
 * range or pointing away hides it.
 */
function Sign({ signId }: { signId: SignId }) {
  const packId = useGame(selectCulturePackId);
  const playing = useGame(selectScreen) === 'playing';
  const pointAtSign = useGame((s) => s.pointAtSign);
  const unpointSign = useGame((s) => s.unpointSign);
  const { position, size } = SIGNS[signId];
  const texture = useMemo(() => paintSign(worldSign(signId, packId), size), [signId, packId, size]);
  useEffect(() => () => texture.dispose(), [texture]);

  const hovered = useRef(false);
  const shown = useRef(false);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLeave = () => {
    if (leaving.current) clearTimeout(leaving.current);
    leaving.current = null;
  };
  useEffect(() => cancelLeave, []);

  // The Character walks while the pointer rests, so range is checked every frame.
  useFrame(() => {
    if (!hovered.current) return;
    const distance = Math.hypot(characterPosition.x - position[0], characterPosition.z - position[2]);
    const inRange = playing && distance <= MOVEMENT.signReadRangeMetres;
    if (inRange && !shown.current) pointAtSign(signId);
    if (!inRange && shown.current) unpointSign(signId, true);
    shown.current = inRange;
  });

  const leave = () => {
    hovered.current = false;
    cancelLeave();
    leaving.current = setTimeout(() => {
      shown.current = false;
      unpointSign(signId);
    }, LEAVE_GRACE_MS);
  };
  // Pointer events reach everything under the pointer, so a sign only counts when nothing stands in front of it.
  const point = (e: ThreeEvent<PointerEvent>) => {
    const inFront = e.intersections[0]?.object === e.eventObject;
    if (!inFront) {
      if (hovered.current) leave();
      return;
    }
    if (hovered.current) return;
    cancelLeave();
    hovered.current = true;
    // Shown again at once if it never hid: the pointer came back within the grace.
    if (shown.current) pointAtSign(signId);
  };

  return (
    <mesh position={[...position]} onPointerOver={point} onPointerMove={point} onPointerOut={leave}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/** Every sign and menu in the town. */
export function Signs() {
  const playing = useGame(selectScreen) === 'playing';
  // The camera follows the Character, so what's under a resting pointer changes without the pointer moving.
  useFrame(({ events }) => {
    if (playing) events.update?.();
  });
  return SIGN_IDS.map((signId) => <Sign key={signId} signId={signId} />);
}
