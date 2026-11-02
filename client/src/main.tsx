import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles/global.css';
import './components/components.css';
import { App } from './App';
import { sfx, unlockAudio } from './lib/sound';

// Звук нажатия на любую кнопку (и «пробуждение» звука после первого клика)
document.addEventListener(
  'pointerdown',
  (e) => {
    unlockAudio();
    const el = (e.target as HTMLElement | null)?.closest('button:not(:disabled), a.btn, [role="button"], [role="radio"], .hex.is-allowed');
    if (el && !el.hasAttribute('data-silent')) sfx.click();
  },
  true,
);
document.addEventListener('keydown', () => unlockAudio(), true);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>,
);
