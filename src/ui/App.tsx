import { useEffect } from 'react';
import { useShowNativeLanguage } from '../i18n/index.ts';
import { selectConversation, selectNativeLanguage, selectScreen, useGame } from '../store/index.ts';
import { Scene } from '../world/index.ts';
import { ConversationColumn } from './ConversationColumn.tsx';
import { Dock } from './Dock.tsx';
import { FaintingScreen } from './FaintingScreen.tsx';
import { GatewayStatus } from './GatewayStatus.tsx';
import { InteractionPrompt } from './InteractionPrompt.tsx';
import { Journal } from './Journal.tsx';
import { PersistCallout } from './PersistCallout.tsx';
import { SetupScreen } from './SetupScreen.tsx';
import { SignTooltip } from './SignTooltip.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { TramPanel } from './TramPanel.tsx';
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

/** The live town is always there: behind the title screen and setup first, then under the HUD. */
export function App() {
  usePauseAndSaveWhenHidden();
  useShowNativeLanguage(useGame(selectNativeLanguage));
  const screen = useGame(selectScreen);
  const talking = useGame(selectConversation) !== null;

  return (
    <main className="game" data-talking={talking || undefined}>
      <Scene />
      {screen === 'title' && <TitleScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'playing' && <Hud />}
    </main>
  );
}

function Hud() {
  return (
    <>
      <GatewayStatus />
      <InteractionPrompt />
      <TramPanel />
      <SignTooltip />
      <Dock />
      <ConversationColumn />
      <Toast />
      <Journal />
      <VoiceUnavailableScreen />
      <FaintingScreen />
      <PersistCallout />
    </>
  );
}
