// @ts-check
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
// Startsidan lånar testsidans stil tills spelet får en egen.
import '../testsida/style.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elementet #root saknas i sidan');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
