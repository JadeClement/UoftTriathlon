import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker in production for PWA capabilities
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  console.log('🔍 Attempting to register service worker...');
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration);
        console.log('🔍 Service Worker scope:', registration.scope);
        console.log('🔍 Service Worker state:', registration.active?.state);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        console.error('❌ Error details:', error.message);
      });
  });
} else {
  console.log('🔍 Service Worker registration skipped:', {
    NODE_ENV: process.env.NODE_ENV,
    serviceWorkerSupported: 'serviceWorker' in navigator
  });
}
