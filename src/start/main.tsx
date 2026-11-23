import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// Testsidans stil ligger under, och motorns tokens och komponenter skriver över den.
import '../testsida/style.css';
import '../theme/tokens.css';
import './start.css';
import '../theme/engine.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elementet #root saknas i sidan');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
