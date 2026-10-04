import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/index.ts';

// Dev scaffold from the skeleton ticket.
type Status = { kind: 'checking' } | { kind: 'reachable'; mock: boolean } | { kind: 'unreachable' };

export function GatewayStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        const body = (await res.json()) as { mock: boolean };
        if (!cancelled) setStatus({ kind: 'reachable', mock: body.mock });
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: 'unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p role="status" className="dev-status">
      {status.kind === 'checking' && t('gateway.checking')}
      {status.kind === 'reachable' && t(status.mock ? 'gateway.reachableMock' : 'gateway.reachable')}
      {status.kind === 'unreachable' && t('gateway.unreachable')}
    </p>
  );
}
