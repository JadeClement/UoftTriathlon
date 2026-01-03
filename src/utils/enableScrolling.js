// Force enable scrolling on iOS Capacitor
// This ensures scrolling works even if native settings are blocking it

if (typeof window !== 'undefined') {
  const enableScrolling = () => {
    // Enable scrolling on body
    if (document.body) {
      document.body.style.overflow = 'auto';
      document.body.style.webkitOverflowScrolling = 'touch';
      document.body.style.touchAction = 'pan-y';
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100%';
    }
    
    // Enable scrolling on html
    if (document.documentElement) {
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.webkitOverflowScrolling = 'touch';
      document.documentElement.style.touchAction = 'pan-y';
      document.documentElement.style.height = 'auto';
    }
    
    // Force enable scrolling on main element
    const main = document.querySelector('main');
    if (main) {
      main.style.overflow = 'visible';
      main.style.height = 'auto';
    }
    
    console.log('✅ Scrolling enabled via JavaScript');
  };
  
  // Run immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableScrolling);
  } else {
    enableScrolling();
  }
  
  // Also try after a short delay (in case Capacitor loads after)
  setTimeout(enableScrolling, 100);
  setTimeout(enableScrolling, 500);
  setTimeout(enableScrolling, 1000);
  
  // Re-enable on window load
  window.addEventListener('load', enableScrolling);
  
  // Re-enable on Capacitor ready (if using Capacitor)
  if (window.Capacitor) {
    window.addEventListener('capacitorReady', enableScrolling);
  }
}

