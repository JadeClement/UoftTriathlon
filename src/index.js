import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './utils/enableScrolling'; // Force enable scrolling on iOS
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA capabilities
// Only enable in production to avoid development errors
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
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
              // Note: Service worker update confirmation - keeping as is for now
              // Could be replaced with a custom modal if needed
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
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      console.log('🚫 Service worker registration blocked in development mode');
      return Promise.reject(new Error('Service worker disabled in development'));
    };
    
    console.log('⚠️ Service Worker disabled in development mode');
  }
} else {
  console.log('⚠️ Service Worker not supported in this browser');
}
