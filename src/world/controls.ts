import type { KeyboardControlsEntry } from '@react-three/drei';

export type Control = 'forward' | 'back' | 'left' | 'right';

export const CONTROLS: KeyboardControlsEntry<Control>[] = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'back', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
];
