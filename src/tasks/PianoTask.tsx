import { type KeyboardEvent, type PointerEvent, useState } from 'react';
import type { PianoKey, PianoView } from '../../supabase/functions/game/piano.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { playMelody, playNote } from '../sound/piano.ts';
import './piano.css';

/** Hur länge en tangent klingar när den slås an. */
const KEY_LENGTH_S = 0.5;
/** Lite tid efter melodin innan den kan spelas igen, så att den hinner klinga ut. */
const AFTER_MELODY_MS = 600;

/** Melodin spelas högt från en mobil, så att alla hör den, så många gånger gruppen vill (Jonas 2026-11-18). */
function MelodyPanel({ piano }: { piano: PianoView }) {
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
    <section className="role-card piano-melody" aria-label="Melodin finns i din mobil">
      <h2>Melodin finns i din mobil</h2>
      <p>Höj volymen och spela den för de andra. Ni kan höra den hur många gånger som helst.</p>
      <button type="button" onClick={listen} disabled={isPlaying}>{isPlaying ? 'Melodin spelas…' : 'Spela melodin'}</button>
    </section>
  );
}

/**
 * Spelarens tangenter. En tangent låter i den egna mobilen när den slås an
 * och skickas till servern, som avgör om de senaste tonerna är melodin.
 * Inget säger till om en fel ton (Jonas 2026-11-18).
 */
export function PianoKeys({ keys, onPlayKey }: { keys: readonly PianoKey[]; onPlayKey: (note: string) => void }) {
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

  if (keys.length === 0) return null;
  return (
    <section className="piano-keys" aria-label="Dina tangenter">
      {keys.map((key) => (
        <button key={key.note} type="button" className="piano-key" onPointerDown={(event) => strikeWithFinger(event, key.note)} onKeyDown={(event) => strikeWithKeyboard(event, key.note)}>
          {key.name}
        </button>
      ))}
    </section>
  );
}

/** Pianot när berättelsen har kommit dit: en mobil spelar melodin högt, och de andra har några tangenter var. Se docs/koncept.md, Pianot. */
export function PianoTask({ piano, canPlay, onPlayKey }: {
  piano: PianoView;
  /** Spelledaren som står utanför har inga tangenter. */
  canPlay: boolean;
  onPlayKey: (note: string) => void;
}) {
  return (
    <div className="piano">
      {piano.hasMelody && <MelodyPanel piano={piano} />}
      {!piano.hasMelody && <p className="hint">Melodin spelas från mobilen hos {piano.melodyPlayerName}. Lyssna och spela den på era tangenter.</p>}
      {canPlay && <PianoKeys keys={piano.myKeys} onPlayKey={onPlayKey} />}
    </div>
  );
}
