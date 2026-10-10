// Public interface of the audio module. Other modules import from here.
import { useEffect } from 'react';
import { gameStore, selectSoundscape, uiSoundsBetween, type UiSound } from '../store/index.ts';
import { createAudioEngine, type AudioEngine } from './engine.ts';

/** Controls that click when pressed. */
const CLICKABLE = 'button, select, [role="tab"], input[type="checkbox"], input[type="radio"]';

let engine: AudioEngine | null = null;

/**
 * Plays the game's sound for as long as the component calling it is mounted: the soundscape the store says, and the UI
 * sounds its changes make, with a click for every control pressed.
 */
export function useSoundtrack() {
  useEffect(() => {
    const playing = createAudioEngine();
    engine = playing;
    playing.apply(selectSoundscape(gameStore.getState()));
    const unsubscribe = gameStore.subscribe((after, before) => {
      playing.apply(selectSoundscape(after));
      for (const sound of uiSoundsBetween(before, after)) playing.play(sound);
    });
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(CLICKABLE)) playing.play('click');
    };
    document.addEventListener('click', onClick, true);
    return () => {
      unsubscribe();
      document.removeEventListener('click', onClick, true);
      playing.close();
      if (engine === playing) engine = null;
    };
  }, []);
}

/** A UI sound the store doesn't know about, such as turning to another page of the Journal. */
export function playUiSound(sound: UiSound) {
  engine?.play(sound);
}
