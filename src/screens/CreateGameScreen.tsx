import { useState } from 'react';
import { NameField } from './NameField.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';

export function CreateGameScreen({ initialName, isBusy, error, onCreate, onBack }: {
  initialName: string;
  isBusy: boolean;
  error: string;
  onCreate: (name: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <ScreenLayout
      onSubmit={() => onCreate(name)}
      actions={
        <>
          <button type="button" className="secondary" onClick={onBack}>Tillbaka</button>
          <button type="submit" disabled={isBusy}>{isBusy ? 'Skapar spelet …' : 'Skapa spelet'}</button>
        </>
      }
    >
      <h1>Starta nytt spel</h1>
      <p>Du blir spelledare och spelar med. De andra går med genom att skanna koden som visas sedan.</p>
      <NameField value={name} onChange={setName} />
      <p className="error" role="alert">{error}</p>
    </ScreenLayout>
  );
}
