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

// Register service worker for PWA capabilities
// Enable in both development and production for testing
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', {
        scope: '/'
      })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully');
        console.log('🔍 Service Worker scope:', registration.scope);
        console.log('🔍 Service Worker state:', registration.active?.state || registration.installing?.state || 'pending');
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('🔄 New service worker available');
              
              // Optionally show update notification to user
              if (window.confirm('A new version is available. Reload to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
        
        // Listen for controller change (service worker updated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 Service worker controller changed, reloading...');
          window.location.reload();
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        console.error('❌ Error details:', error.message);
      });
  });
} else {
  console.log('⚠️ Service Worker not supported in this browser');
}
