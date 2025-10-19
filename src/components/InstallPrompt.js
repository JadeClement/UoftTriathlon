import React from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (installed || !deferredPrompt) return null;

  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0f172a', color: 'white', padding: '10px 14px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>Add this app to your home screen for quick access.</span>
        <button onClick={handleInstall} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Install</button>
      </div>
    </div>
  );
}
