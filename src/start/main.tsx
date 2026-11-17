import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// Startsidan lånar testsidans färger och knappar tills spelet får en egen stil.
import '../testsida/style.css';
import './start.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elementet #root saknas i sidan');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
