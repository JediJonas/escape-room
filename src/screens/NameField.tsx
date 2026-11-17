import { MAX_NAME_LENGTH } from '../../supabase/functions/game/lobby.ts';

export function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <p className="field">
      <label htmlFor="player-name">Ditt namn</label>
      <input
        id="player-name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="nickname"
        enterKeyHint="go"
        required
      />
    </p>
  );
}
