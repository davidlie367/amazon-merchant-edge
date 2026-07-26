import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent pinch-to-zoom (multi-touch) on mobile devices
document.addEventListener('touchstart', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

// Prevent Safari-specific gesture zooming
document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
