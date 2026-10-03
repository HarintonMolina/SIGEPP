import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './config/env';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app/App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontró el contenedor de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
