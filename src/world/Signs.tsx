import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Mesh, SRGBColorSpace } from 'three';
import { SIGN_IDS, worldSign, type SignId, type SignLine } from '../content/index.ts';
import { selectCulturePackId, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { placeAt, SIGNS } from './town.ts';
import { PALETTE } from './palette.ts';

/** Pixels per metre of sign. */
const RESOLUTION = 256;
const INK = PALETTE.ink;
const BOARD = PALETTE.cream;
const FONT = 'system-ui, "Hiragino Sans", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", sans-serif';

/**
 * Paints a sign's lines onto a canvas: the first line as its heading, and any
 * note (a price or a time) right-aligned beside its line. A sign of one line
 * with a note (opening hours) has the note on a row of its own, under it.
 */
function paintSign(lines: SignLine[], [width, height]: readonly [number, number]) {
  const [only] = lines;
  const timeBelow = lines.length === 1 && !!only?.note;
  const rows = timeBelow ? [{ ...only, note: null }, { text: only.note!, note: null, glosses: {} }] : lines;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * RESOLUTION);
  canvas.height = Math.round(height * RESOLUTION);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BOARD;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  const pad = canvas.height * (rows.length === 1 ? 0.18 : 0.08);
  const rowHeight = (canvas.height - pad * 2) / (rows.length + (rows.length > 1 ? 0.4 : 0));
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  rows.forEach(({ text, note }, i) => {
    const heading = i === 0 && rows.length > 1;
    const size = rowHeight * (heading ? 0.85 : 0.62);
    const y = pad + rowHeight * (i + 0.5 + (i > 0 && rows.length > 1 ? 0.4 : 0));
    ctx.font = `${heading ? 'bold ' : ''}${Math.round(size)}px ${FONT}`;
    if (!note) {
      ctx.textAlign = rows.length === 1 || timeBelow || heading ? 'center' : 'left';
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

/** A sign painted from the Culture Pack. */
function Sign({ signId }: { signId: SignId }) {
  const packId = useGame(selectCulturePackId);
  const { position, size, rotation = 0, liftsInside } = SIGNS[signId];
  const board = useRef<Mesh>(null);
  const texture = useMemo(() => paintSign(worldSign(signId, packId), size), [signId, packId, size]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (liftsInside && board.current) {
      // Lifted off, the board is out of sight.
      const lifted = placeAt(characterPosition.x, characterPosition.z) === liftsInside;
      board.current.visible = !lifted;
    }
  });

  return (
    <mesh ref={board} position={[...position]} rotation-y={rotation}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/** Every sign and menu in the town. */
export function Signs() {
  return SIGN_IDS.map((signId) => <Sign key={signId} signId={signId} />);
}
