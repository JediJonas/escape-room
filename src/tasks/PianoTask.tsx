import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import type { PianoKey, PianoView } from '../../supabase/functions/game/piano.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { playMelody, playNote } from '../sound/piano.ts';
import { OCTAVE_IMAGE, layOutPianoKeys } from './pianoLayout.ts';
import './piano.css';

/** Hur länge en tangent klingar när den slås an. */
const KEY_LENGTH_S = 0.5;
/** Lite tid efter melodin innan den kan spelas igen, så att den hinner klinga ut. */
const AFTER_MELODY_MS = 600;

/** Knappen som spelar melodin högt från en mobil, så att alla hör den, så många gånger gruppen vill (Jonas 2026-11-18). */
export function MelodyButton({ piano }: { piano: PianoView }) {
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

  return <button type="button" className="piano-melody" onClick={listen} disabled={isPlaying}>{isPlaying ? 'Melodin spelas…' : 'Spela melodin'}</button>;
}

function MelodyPanel({ piano }: { piano: PianoView }) {
  if (!piano.melody) return null;
  return (
    <section className="role-card" aria-label="Melodin finns i din mobil">
      <h2>Melodin finns i din mobil</h2>
      <p>Höj volymen och spela den för de andra. Ni kan höra den hur många gånger som helst.</p>
      <MelodyButton piano={piano} />
    </section>
  );
}

/** Lägena räknas i procent av fönstrets bredd. */
const PERCENT = 100;

function toPercent(pixels: number, width: number): string {
  return `${(pixels / width) * PERCENT}%`;
}

/**
 * Spelarens tangenter, ritade som en bit av ett riktigt piano: fyra
 * intilliggande vita tangenter och de svarta däremellan och i kanterna
 * (Jonas 2026-11-18). Pianot är en tecknad bild av en oktav, och knapparna
 * ligger osynliga ovanpå tangenterna i bilden (Jonas 2026-11-23).
 * En vit tangent låter i den egna mobilen och skickas till servern, som avgör
 * om de senaste tonerna är melodin. De svarta finns inte i melodin, så de
 * låter bara i mobilen. Inget säger till om en fel ton (Jonas 2026-11-18).
 */
export function PianoKeys({ keys, onPlayKey }: { keys: readonly PianoKey[]; onPlayKey: (note: string) => void }) {
  // En ton som inte kunde höras när fingret sattes ned, eftersom ljudmotorn inte var
  // upplåst än. iPhone låser bara upp när fingret lyfts, så tonen spelas då i stället.
  const waitingNote = useRef<string | null>(null);

  function strike(event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>, note: string, isWhite: boolean) {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    // Tonen ska komma direkt i trycket, inte när fingret lyfts.
    event.preventDefault();
    gameAudio.unlock();
    if (gameAudio.isRunning() || 'key' in event) void playNote(gameAudio, note, KEY_LENGTH_S);
    else waitingNote.current = note;
    if (isWhite) onPlayKey(note);
  }

  const forget = () => { waitingNote.current = null; };

  function release() {
    const note = waitingNote.current;
    if (note === null) return;
    waitingNote.current = null;
    gameAudio.unlock();
    void playNote(gameAudio, note, KEY_LENGTH_S);
  }

  const layout = layOutPianoKeys(keys.map((key) => key.note));
  if (!layout) return null;
  const { width } = layout;
  const names = new Map(keys.map((key) => [key.note, key.name]));
  return (
    <section className="piano-keys" aria-label="Dina tangenter">
      <div className="piano-window" style={{ '--keys-ratio': width / OCTAVE_IMAGE.height } as CSSProperties}>
        <div className="piano-octaves" aria-hidden="true" style={{ left: toPercent(layout.imageLeft, width), width: toPercent(2 * OCTAVE_IMAGE.width, width) }} />
        {layout.whiteKeys.map(({ note, left, width: keyWidth }) => (
          <button key={note} type="button" className="piano-key" style={{ left: toPercent(left, width), width: toPercent(keyWidth, width) }} onPointerDown={(event) => strike(event, note, true)} onPointerUp={release} onPointerCancel={forget} onKeyDown={(event) => strike(event, note, true)}>
            {names.get(note)}
          </button>
        ))}
        {layout.blackKeys.map(({ note, left, width: keyWidth }) => (
          <button
            key={note}
            type="button"
            className="piano-key piano-key-black"
            aria-label="Svart tangent"
            style={{ left: toPercent(left, width), width: toPercent(keyWidth, width) }}
            onPointerDown={(event) => strike(event, note, false)}
            onPointerUp={release}
            onPointerCancel={forget}
            onKeyDown={(event) => strike(event, note, false)}
          />
        ))}
      </div>
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
      {!piano.hasMelody && <p className="hint">{piano.melodyPlayerName} har melodin i sin mobil. Lyssna när den spelas, och spela den sedan på era tangenter. Varje tangent hörs bara i din egen mobil.</p>}
      {piano.hasMelody && piano.myKeys.length > 0 && <p className="hint">Spela den sedan tillsammans på era tangenter.</p>}
      {canPlay && <PianoKeys keys={piano.myKeys} onPlayKey={onPlayKey} />}
    </div>
  );
}

