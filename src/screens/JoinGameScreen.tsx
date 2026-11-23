import { useState } from 'react';
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '../../supabase/functions/game/joinCode.ts';
import { NameField } from './NameField.tsx';
import { BackChip } from './BackChip.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';

export function JoinGameScreen({ initialCode, initialName, isBusy, error, onJoin, onBack }: {
  initialCode: string;
  initialName: string;
  isBusy: boolean;
  error: string;
  onJoin: (joinCode: string, name: string) => void;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  return (
    <ScreenLayout
      top={<BackChip onClick={onBack} />}
      onSubmit={() => onJoin(joinCode, name)}
      actions={<button type="submit" disabled={isBusy}>{isBusy ? 'Går med …' : 'Gå med'}</button>}
    >
      <h1 className="page-title">Gå med i spel</h1>
      <p className="lead">Skriv koden som syns i spelledarens mobil.</p>
      <div className="field">
        <label htmlFor="join-code">Koden</label>
        {/* Koden visas i fyra rutor. Fältet ligger osynligt ovanpå, så att tangentbord och skärmläsare fungerar som vanligt. */}
        <div className="code-boxes">
          {Array.from({ length: JOIN_CODE_LENGTH }, (_, index) => (
            <span key={index} className={index === Math.min(joinCode.length, JOIN_CODE_LENGTH - 1) ? 'is-next' : undefined} aria-hidden="true">{joinCode[index] ?? ''}</span>
          ))}
          <input
            id="join-code"
            className="code-boxes-input"
            value={joinCode}
            onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
            maxLength={JOIN_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
      </div>
      <NameField value={name} onChange={setName} />
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
