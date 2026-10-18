import { createRoot } from 'react-dom/client';
import '@fontsource-variable/doto';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
