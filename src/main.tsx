import { createRoot } from 'react-dom/client';
import '@fontsource-variable/doto';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles.css';
import { App } from './App.tsx';
import { runBoot } from './brand/boot.ts';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
// The preloader in index.html stays up until fonts, the window load and every registered
// critical asset (hero 3D: download + shader compile + first frame) have settled.
void runBoot();
