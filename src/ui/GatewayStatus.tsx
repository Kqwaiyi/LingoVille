import { useEffect, useState } from 'react';

// Dev scaffold from the skeleton ticket. Its strings move to i18n once that module lands.
type Status = { kind: 'checking' } | { kind: 'reachable'; mock: boolean } | { kind: 'unreachable' };

export function GatewayStatus() {
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
      {status.kind === 'checking' && 'Checking gateway…'}
      {status.kind === 'reachable' && `Gateway reachable${status.mock ? ' (mock mode)' : ''}`}
      {status.kind === 'unreachable' && 'Gateway unreachable'}
    </p>
  );
}
