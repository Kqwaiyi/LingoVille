import { useEffect } from 'react';
import { selectConversation, useGame } from '../store/index.ts';
import { Scene } from '../world/index.ts';
import { ConversationColumn } from './ConversationColumn.tsx';
import { Dock } from './Dock.tsx';
import { GatewayStatus } from './GatewayStatus.tsx';
import { InteractionPrompt } from './InteractionPrompt.tsx';
import { Journal } from './Journal.tsx';
import { Toast, VoiceUnavailableScreen } from './VoiceNotices.tsx';
import './hud.css';

/** Pauses the game while the browser tab is hidden. */
function usePauseWhenHidden() {
  const setTabHidden = useGame((s) => s.setTabHidden);
  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [setTabHidden]);
}

export function App() {
  usePauseWhenHidden();
  const talking = useGame(selectConversation) !== null;

  return (
    <main className="game" data-talking={talking || undefined}>
      <Scene />
      <GatewayStatus />
      <InteractionPrompt />
      <Dock />
      <ConversationColumn />
      <Toast />
      <Journal />
      <VoiceUnavailableScreen />
    </main>
  );
}
