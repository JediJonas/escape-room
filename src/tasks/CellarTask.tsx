import { useEffect, useRef, useState } from 'react';
import type { CellarView } from '../../supabase/functions/game/cellar.ts';
import type { LookDirection } from '../view/lookDirection.ts';
import { RoundImageView } from '../view/RoundImageView.tsx';
import { describeThreat, hasTimeRunOut, isLampLit, measureThreat } from './cellarText.ts';
import { useServerNow } from './useServerNow.ts';
import './cellar.css';

/** Tätt nog för att lampan ska slockna i tid och ljuset kännas levande. */
const TICK_MS = 250;
/** Hur länge raden om ett fel tryck står kvar. */
const WRONG_TAP_NOTICE_MS = 2500;

/** Mobilen säger till en gång när tiden har gått ut. Servern avgör. */
function useTimeUpNotice(cellar: CellarView, serverNowMs: number, onTimeUp: () => void) {
  const hasToldRef = useRef(false);
  const isOut = hasTimeRunOut(cellar, serverNowMs);
  useEffect(() => {
    if (!isOut || hasToldRef.current) return;
    hasToldRef.current = true;
    onTimeUp();
  }, [isOut, onTimeUp]);
}

/**
 * Den instängdas mobil: källaren i mörker, med en ficklampa mitt på
 * skärmen. Lampan i taket tänds en stund när de andra slår på en säkring.
 * Ett tryck var som helst på skärmen prövar riktningen mitt i ljuset.
 */
export function CellarDark({ cellar, image, clockOffsetMs, onOpenDoor, onTimeUp }: {
  cellar: CellarView;
  image: string;
  clockOffsetMs: number;
  onOpenDoor: (yawDeg: number) => void;
  onTimeUp: () => void;
}) {
  const lookRef = useRef<LookDirection>({ yawDeg: 0, pitchDeg: 0 });
  const serverNowMs = useServerNow(clockOffsetMs, TICK_MS);
  useTimeUpNotice(cellar, serverNowMs, onTimeUp);
  // Kom det närmare sedan förra vyn var trycket fel. Det visas en stund.
  const [wrongTapUntilMs, setWrongTapUntilMs] = useState(0);
  const [lastCatchMs, setLastCatchMs] = useState(cellar.catchMs);
  if (cellar.catchMs !== lastCatchMs) {
    setLastCatchMs(cellar.catchMs);
    if (lastCatchMs !== null && cellar.catchMs !== null && cellar.catchMs < lastCatchMs) setWrongTapUntilMs(serverNowMs + WRONG_TAP_NOTICE_MS);
  }
  const isLit = isLampLit(cellar, serverNowMs);
  const isWrongTapShown = serverNowMs < wrongTapUntilMs;

  return (
    <RoundImageView src={`${import.meta.env.BASE_URL}${image}`} lookRef={lookRef} onTap={() => onOpenDoor(lookRef.current.yawDeg)}>
      <div className={isLit ? 'cellar-dark is-lit' : 'cellar-dark'} aria-hidden="true" />
      <div className="cellar-status" role="status">
        <p>{isWrongTapShown ? 'Bara kall sten. Något hörde dig.' : describeThreat(measureThreat(cellar, serverNowMs))}</p>
        <p>{isLit ? 'Lampan lyser!' : 'Tryck när dörren är mitt i ljuset.'}</p>
      </div>
    </RoundImageView>
  );
}

/** Det de andra ser: vem som är nere, hur nära det är och om lampan lyser. */
export function CellarStatus({ cellar, clockOffsetMs, onTimeUp }: {
  cellar: CellarView;
  clockOffsetMs: number;
  onTimeUp: () => void;
}) {
  const serverNowMs = useServerNow(clockOffsetMs, TICK_MS);
  useTimeUpNotice(cellar, serverNowMs, onTimeUp);
  if (cellar.outcomeText) return <p className="place-text">{cellar.outcomeText}</p>;
  if (cellar.isTrapped) return null;
  if (cellar.catchMs === null) return <p className="status" role="status">Väntar på att {cellar.trappedName} ska komma ner i källaren.</p>;
  const threat = measureThreat(cellar, serverNowMs);
  return (
    <section className="hint-card" aria-label="Källaren">
      <p>{cellar.trappedName} är i källaren. {describeThreat(threat)}</p>
      <meter className="cellar-threat" min={0} max={1} value={threat} aria-label="Hur nära det är" />
      <p>{isLampLit(cellar, serverNowMs) ? 'Lampan lyser i källaren just nu.' : `Säkringar kvar: ${cellar.fusesLeft}.`}</p>
    </section>
  );
}
