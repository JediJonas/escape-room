import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import type { PianoView } from '../../supabase/functions/game/piano.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { playFalseNote, playMelody, playNote } from '../sound/piano.ts';
import './piano.css';

/** Hur länge en tangent klingar när den slås an. */
const KEY_LENGTH_S = 0.5;
/** Hur länge det står att gruppen spelade fel. */
const WRONG_SHOWN_MS = 3000;
/** Lite tid efter melodin innan lyssnaren kan spela den igen, så att den hinner klinga ut. */
const AFTER_MELODY_MS = 600;

/** Säger till när gruppen har spelat fel, med en falsk ton i alla mobiler. */
function useWrongNote(wrongNotes: number): boolean {
  const seen = useRef(wrongNotes);
  const [isShown, setIsShown] = useState(false);
  useEffect(() => {
    if (wrongNotes <= seen.current) return undefined;
    seen.current = wrongNotes;
    void playFalseNote(gameAudio);
    setIsShown(true);
    const timer = setTimeout(() => setIsShown(false), WRONG_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [wrongNotes]);
  return isShown;
}

function Progress({ piano }: { piano: PianoView }) {
  return (
    <div className="piano-progress">
      <p className="hint">{piano.playedCount} av {piano.noteCount} toner rätt i följd</p>
      <div className="piano-dots" aria-hidden="true">
        {Array.from({ length: piano.noteCount }, (_, index) => <span key={index} className={index < piano.playedCount ? 'is-played' : undefined} />)}
      </div>
    </div>
  );
}

/** Lyssnaren hör melodin, så många gånger hon vill, och nynnar den för de andra. */
function ListenerPanel({ piano }: { piano: PianoView }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { melody } = piano;
  if (!melody) return null;
  const melodyMs = melody.reduce((sum, tone) => sum + tone.beats * piano.beatMs, 0) + AFTER_MELODY_MS;

  function listen() {
    gameAudio.unlock();
    setIsPlaying(true);
    void playMelody(gameAudio, melody ?? [], piano.beatMs);
    setTimeout(() => setIsPlaying(false), melodyMs);
  }

  return (
    <section className="role-card piano-listener" aria-label="Bara du hör melodin">
      <h2>Du hör melodin</h2>
      <p>Bara din mobil spelar den. Håll mobilen mot örat, lyssna och nynna den för de andra, en ton i taget. Du kan höra den hur många gånger som helst.</p>
      <button type="button" onClick={listen} disabled={isPlaying}>{isPlaying ? 'Melodin spelas…' : 'Hör melodin'}</button>
    </section>
  );
}

/**
 * Pianot. Lyssnaren hör melodin, och de andra har några tangenter var. En
 * tangent låter i den egna mobilen när den slås an, och servern avgör om
 * det var nästa ton. Se docs/koncept.md, Pianot.
 */
export function PianoTask({ piano, canPlay, onPlayKey }: {
  piano: PianoView;
  /** Spelledaren som står utanför har inga tangenter. */
  canPlay: boolean;
  onPlayKey: (note: string) => void;
}) {
  const isWrongShown = useWrongNote(piano.wrongNotes);

  function strike(note: string) {
    gameAudio.unlock();
    void playNote(gameAudio, note, KEY_LENGTH_S);
    onPlayKey(note);
  }

  function strikeWithFinger(event: PointerEvent<HTMLButtonElement>, note: string) {
    // Tonen ska komma direkt i trycket, inte när fingret lyfts.
    event.preventDefault();
    strike(note);
  }

  function strikeWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, note: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    strike(note);
  }

  return (
    <div className="piano">
      {piano.isListener && <ListenerPanel piano={piano} />}
      {!piano.isListener && <p className="hint">{piano.listenerName} hör melodin och nynnar den. Lyssna och spela den ton för ton.</p>}
      <Progress piano={piano} />
      <p className={isWrongShown ? 'status piano-wrong is-shown' : 'status piano-wrong'} role="status">{isWrongShown ? 'En falsk ton. Börja om från första tonen.' : ''}</p>
      {canPlay && piano.myKeys.length > 0 && (
        <section className="piano-keys" aria-label="Dina tangenter">
          {piano.myKeys.map((key) => (
            <button key={key.note} type="button" className="piano-key" onPointerDown={(event) => strikeWithFinger(event, key.note)} onKeyDown={(event) => strikeWithKeyboard(event, key.note)}>
              {key.name}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
