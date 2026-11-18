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

/** Den svarta tangentens plats räknas i procent av pianots bredd. */
const PERCENT = 100;

/** Vita tangenter som har en svart tangent emellan, som på ett riktigt piano. Mellan E och F och mellan H och C finns ingen. */
const HAS_BLACK_AFTER = new Set(['C', 'D', 'F', 'G', 'A']);

/** Den svarta tangenten efter en vit, till exempel C#4 efter C4, eller null. */
function findBlackAfter(note: string): string | null {
  const match = /^([A-G])(\d)$/.exec(note);
  return match && HAS_BLACK_AFTER.has(match[1]) ? `${match[1]}#${match[2]}` : null;
}

/**
 * Spelarens tangenter, ritade som en bit av ett riktigt piano: fyra
 * intilliggande vita tangenter och de svarta däremellan (Jonas 2026-11-18).
 * En vit tangent låter i den egna mobilen och skickas till servern, som avgör
 * om de senaste tonerna är melodin. De svarta finns inte i melodin, så de
 * låter bara i mobilen. Inget säger till om en fel ton (Jonas 2026-11-18).
 */
export function PianoKeys({ keys, onPlayKey }: { keys: readonly PianoKey[]; onPlayKey: (note: string) => void }) {
  function sound(note: string) {
    gameAudio.unlock();
    void playNote(gameAudio, note, KEY_LENGTH_S);
  }

  function strike(event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>, note: string, isWhite: boolean) {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    // Tonen ska komma direkt i trycket, inte när fingret lyfts.
    event.preventDefault();
    sound(note);
    if (isWhite) onPlayKey(note);
  }

  if (keys.length === 0) return null;
  return (
    <section className="piano-keys" aria-label="Dina tangenter">
      {keys.map((key) => (
        <button key={key.note} type="button" className="piano-key" onPointerDown={(event) => strike(event, key.note, true)} onKeyDown={(event) => strike(event, key.note, true)}>
          {key.name}
        </button>
      ))}
      {keys.slice(0, -1).map((key, index) => {
        const black = findBlackAfter(key.note);
        if (!black) return null;
        return (
          <button
            key={black}
            type="button"
            className="piano-key piano-key-black"
            aria-label={`Svart tangent mellan ${key.name} och ${keys[index + 1].name}`}
            style={{ left: `${((index + 1) / keys.length) * PERCENT}%` }}
            onPointerDown={(event) => strike(event, black, false)}
            onKeyDown={(event) => strike(event, black, false)}
          />
        );
      })}
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
