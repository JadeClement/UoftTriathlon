import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import './utils/enableScrolling'; // Force enable scrolling on iOS
import App from './App';

const isNativeApp = Capacitor.isNativePlatform();

// Clear any service worker left over from an older build in the native app.
if (isNativeApp && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA capabilities (web only).
// Skip in Capacitor native apps — SW caching can interfere with API requests in WebView.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && !isNativeApp) {
  window.addEventListener('load', () => {
    const pageLoadedAt = Date.now();
    let reloading = false;

    const activateWorker = (worker) => {
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    navigator.serviceWorker
      .register('/service-worker.js', {
        scope: '/'
      })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully');

        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWorker(newWorker);
            }
          });
        });

        // Already reloading/opening the page — activate the new worker instead of asking.
        if (registration.waiting) {
          activateWorker(registration.waiting);
        }
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        console.error('❌ Error details:', error.message);
      });

    // Reload only for updates found while this tab is already open.
    // A waiting worker on load must not trigger another reload (that loops the prompt/reload).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || Date.now() - pageLoadedAt < 3000) return;
      reloading = true;
      window.location.reload();
    });
  });
} else if (process.env.NODE_ENV === 'development') {
  // Unregister any existing service workers in development
  if ('serviceWorker' in navigator) {
    // Immediately unregister all service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        console.log(`🧹 Unregistering ${registrations.length} service worker(s) for development`);
        Promise.all(registrations.map(reg => reg.unregister())).then(() => {
          console.log('✅ All service workers unregistered');
        });
      }
    });
    
    // Also unregister the current controller if it exists
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Prevent any new registrations by overriding the register method
    navigator.serviceWorker.register = function() {
      console.log('🚫 Service worker registration blocked in development mode');
      return Promise.reject(new Error('Service worker disabled in development'));
    };
    
    console.log('⚠️ Service Worker disabled in development mode');
  }
} else {
  console.log('⚠️ Service Worker not supported in this browser');
}
