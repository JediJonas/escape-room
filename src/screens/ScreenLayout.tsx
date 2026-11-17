import type { FormEvent, ReactNode } from 'react';

/**
 * En skärm med innehåll överst och knapparna längst ner, nära tummen. Med mus
 * står knapparna direkt under innehållet. Se start.css och skillen
 * knappar-i-mobilen.
 *
 * Efter startsidan ligger huvudhandlingen underst, närmast tummen
 * (Jonas 2026-11-17). Startsidan har sina två val i den ordning de har.
 */
export function ScreenLayout({ children, actions, onSubmit }: {
  children: ReactNode;
  actions: ReactNode;
  /** Med en funktion blir skärmen ett formulär, så att Enter skickar det. */
  onSubmit?: () => void;
}) {
  const body = (
    <>
      <div className="screen-content">{children}</div>
      <div className="screen-actions">{actions}</div>
    </>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };
  return (
    <main className="screen">
      {onSubmit ? <form className="screen-body" onSubmit={submit} noValidate>{body}</form> : <div className="screen-body">{body}</div>}
    </main>
  );
}
