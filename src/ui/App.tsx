import { useEffect } from 'react';
import { selectConversation, selectScreen, useGame } from '../store/index.ts';
import { Scene } from '../world/index.ts';
import { ConversationColumn } from './ConversationColumn.tsx';
import { Dock } from './Dock.tsx';
import { GatewayStatus } from './GatewayStatus.tsx';
import { InteractionPrompt } from './InteractionPrompt.tsx';
import { Journal } from './Journal.tsx';
import { PersistCallout } from './PersistCallout.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { Toast, VoiceUnavailableScreen } from './VoiceNotices.tsx';
import './hud.css';

/** Pauses the game while the browser tab is hidden, and saves as it hides or the page closes. */
function usePauseAndSaveWhenHidden() {
  const setTabHidden = useGame((s) => s.setTabHidden);
  const saveNow = useGame((s) => s.saveNow);
  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', saveNow);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', saveNow);
    };
  }, [setTabHidden, saveNow]);
}

/** The live town is always there: behind the title screen first, then under the HUD. */
export function App() {
  usePauseAndSaveWhenHidden();
  const screen = useGame(selectScreen);
  const talking = useGame(selectConversation) !== null;

  return (
    <main className="game" data-talking={talking || undefined}>
      <Scene />
      {screen === 'title' ? <TitleScreen /> : <Hud />}
    </main>
  );
}

function Hud() {
  return (
    <>
      <GatewayStatus />
      <InteractionPrompt />
      <Dock />
      <ConversationColumn />
      <Toast />
      <Journal />
      <VoiceUnavailableScreen />
      <PersistCallout />
    </>
  );
}
