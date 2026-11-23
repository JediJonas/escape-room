import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import type { PianoKey, PianoView } from '../../supabase/functions/game/piano.ts';
import { gameAudio } from '../sound/gameAudio.ts';
import { playMelody, playNote } from '../sound/piano.ts';
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

/** Den svarta tangentens plats räknas i procent av pianots bredd. */
const PERCENT = 100;

/** Vita tangenter som har en svart tangent emellan, som på ett riktigt piano. Mellan E och F och mellan B och C finns ingen. */
const HAS_BLACK_AFTER = new Set(['C', 'D', 'F', 'G', 'A']);

/** De vita tangenterna i en oktav, från C. */
const WHITE_LETTERS = 'CDEFGAB';

/** Den svarta tangenten efter en vit, till exempel C#4 efter C4, eller null. */
function findBlackAfter(note: string): string | null {
  const match = /^([A-G])(\d)$/.exec(note);
  return match && HAS_BLACK_AFTER.has(match[1]) ? `${match[1]}#${match[2]}` : null;
}

/** Den vita tangenten närmast under, till exempel B3 under C4. */
function findWhiteBelow(note: string): string | null {
  const match = /^([A-G])(\d)$/.exec(note);
  if (!match) return null;
  const index = WHITE_LETTERS.indexOf(match[1]);
  const octave = Number(match[2]);
  return index === 0 ? `B${octave - 1}` : `${WHITE_LETTERS[index - 1]}${octave}`;
}

/**
 * De svarta tangenterna och var de ligger, räknat i vita tangenter från
 * vänster. Den före den första och den efter den sista hamnar i kanten och
 * syns till hälften, som på ett riktigt piano (Jonas 2026-11-18).
 */
function placeBlackKeys(keys: readonly PianoKey[]): { note: string; position: number }[] {
  const below = findWhiteBelow(keys[0].note);
  const edges = [below === null ? null : findBlackAfter(below), ...keys.map((key) => findBlackAfter(key.note))];
  return edges.flatMap((note, position) => (note === null ? [] : [{ note, position }]));
}

/**
 * Spelarens tangenter, ritade som en bit av ett riktigt piano: fyra
 * intilliggande vita tangenter och de svarta däremellan och i kanterna
 * (Jonas 2026-11-18).
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

  if (keys.length === 0) return null;
  return (
    <section className="piano-keys" aria-label="Dina tangenter">
      {keys.map((key) => (
        <button key={key.note} type="button" className="piano-key" onPointerDown={(event) => strike(event, key.note, true)} onPointerUp={release} onPointerCancel={forget} onKeyDown={(event) => strike(event, key.note, true)}>
          {key.name}
        </button>
      ))}
      {placeBlackKeys(keys).map(({ note, position }) => (
        <button
          key={note}
          type="button"
          className="piano-key piano-key-black"
          aria-label="Svart tangent"
          style={{ left: `${(position / keys.length) * PERCENT}%` }}
          onPointerDown={(event) => strike(event, note, false)}
          onPointerUp={release}
          onPointerCancel={forget}
          onKeyDown={(event) => strike(event, note, false)}
        />
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
      {!piano.hasMelody && <p className="hint">{piano.melodyPlayerName} har melodin i sin mobil. Lyssna när den spelas, och spela den sedan på era tangenter. Varje tangent hörs bara i din egen mobil.</p>}
      {piano.hasMelody && piano.myKeys.length > 0 && <p className="hint">Spela den sedan tillsammans på era tangenter.</p>}
      {canPlay && <PianoKeys keys={piano.myKeys} onPlayKey={onPlayKey} />}
    </div>
  );
}

