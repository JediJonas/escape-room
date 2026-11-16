// @ts-check
import { VERSION } from '../config.js';

/** Startsidan. Än så länge leder den bara till den tekniska testsidan. */
export function App() {
  return (
    <>
      <header>
        <h1>Escape room för mobiler</h1>
        <p>Spelet är under bygge. Än så länge finns bara den tekniska testsidan.</p>
      </header>
      <main>
        <p><a className="button-link" href="testsida/">Öppna testsidan</a></p>
      </main>
      <footer>
        <p>Version {VERSION}</p>
      </footer>
    </>
  );
}
