import { useState } from 'react';
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '../../supabase/functions/game/joinCode.ts';
import { NameField } from './NameField.tsx';
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
      onSubmit={() => onJoin(joinCode, name)}
      actions={
        <>
          <button type="button" className="secondary" onClick={onBack}>Tillbaka</button>
          <button type="submit" disabled={isBusy}>{isBusy ? 'Går med …' : 'Gå med'}</button>
        </>
      }
    >
      <h1>Gå med i spel</h1>
      <p className="field">
        <label htmlFor="join-code">Koden från spelledaren</label>
        <input
          id="join-code"
          className="join-code-input"
          value={joinCode}
          onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
          maxLength={JOIN_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </p>
      <NameField value={name} onChange={setName} />
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
