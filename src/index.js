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
    let updatePrompted = false; // Track if we've already prompted for this update
    let userAcceptedUpdate = false; // Track if user accepted the update
    let reloadAttempted = false; // Prevent infinite reload loops
    
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
              
              // Only show prompt once per update
              if (!updatePrompted) {
                updatePrompted = true;
                
                // Optionally show update notification to user
                // Note: Service worker update confirmation - keeping as is for now
                // Could be replaced with a custom modal if needed
                if (window.confirm('A new version is available. Reload to update?')) {
                  userAcceptedUpdate = true;
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  // Don't reload here - let controllerchange handle it
                } else {
                  // User declined - reset flag after a delay to allow future updates
                  setTimeout(() => {
                    updatePrompted = false;
                  }, 5000);
                }
              }
            }
          });
        });
        
        // Check if there's already a waiting service worker on page load
        if (registration.waiting) {
          console.log('🔄 Waiting service worker detected on page load');
          if (!updatePrompted) {
            updatePrompted = true;
            if (window.confirm('A new version is available. Reload to update?')) {
              userAcceptedUpdate = true;
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
              setTimeout(() => {
                updatePrompted = false;
              }, 5000);
            }
          }
        }
        
        // Listen for controller change (service worker updated)
        // Only auto-reload if user accepted the update
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 Service worker controller changed');
          if (userAcceptedUpdate && !reloadAttempted) {
            console.log('🔄 Reloading due to accepted update...');
            reloadAttempted = true; // Prevent multiple reloads
            userAcceptedUpdate = false; // Reset flag
            updatePrompted = false; // Reset prompt flag
            // Use a small delay to ensure the new service worker is ready
            setTimeout(() => {
              window.location.reload();
            }, 100);
          } else {
            console.log('🔄 Controller changed but user did not accept update, skipping reload');
            updatePrompted = false; // Reset so they can be prompted again if needed
          }
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
    navigator.serviceWorker.register = function() {
      console.log('🚫 Service worker registration blocked in development mode');
      return Promise.reject(new Error('Service worker disabled in development'));
    };
    
    console.log('⚠️ Service Worker disabled in development mode');
  }
} else {
  console.log('⚠️ Service Worker not supported in this browser');
}
