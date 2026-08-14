import { useState, useEffect } from 'react';

type Platform = 'android' | 'ios' | null;

// Key used in sessionStorage — banner stays dismissed for the browser session.
const DISMISSED_KEY = 'pwa-install-banner-dismissed';

export function InstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if already dismissed this session.
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Don't show if already running as an installed PWA.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;

    if (isIOS) {
      // Only prompt in Safari. CriOS / FxiOS / OPiOS are Chrome/Firefox/Opera on iOS;
      // they don't support Add to Home Screen the same way and have their own prompts.
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
      if (isSafari) setPlatform('ios');
      return;
    }

    // Android / Chrome desktop: pick up the beforeinstallprompt event.
    // The Layout script captures it early onto window.__deferredInstallPrompt and
    // dispatches 'pwa-install-ready' so we don't miss it due to hydration timing.
    const existing = (window as any).__deferredInstallPrompt;
    if (existing) {
      setDeferredPrompt(existing);
      setPlatform('android');
    }

    const onReady = () => {
      const prompt = (window as any).__deferredInstallPrompt;
      if (prompt) {
        setDeferredPrompt(prompt);
        setPlatform('android');
      }
    };
    window.addEventListener('pwa-install-ready', onReady);
    return () => window.removeEventListener('pwa-install-ready', onReady);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setPlatform(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    (window as any).__deferredInstallPrompt = null;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!platform) return null;

  return (
    <div
      role="region"
      aria-label="Install app banner"
      className="bg-blue-600 text-white text-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        {platform === 'android' ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              {/* Download / install icon */}
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>Install this app for quick access to Mass times!</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstall}
                className="bg-white text-blue-700 font-semibold px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                aria-label="Dismiss install banner"
                className="text-blue-200 hover:text-white transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {/* iOS "share / upload" style icon */}
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v13m0-13l-3.5 3.5M12 3l3.5 3.5M6 17v1.5A1.5 1.5 0 007.5 20h9a1.5 1.5 0 001.5-1.5V17"
                />
              </svg>
              <span>
                Install this app: tap the{' '}
                <strong>Share</strong> button, then{' '}
                <strong>"Add to Home Screen"</strong>
              </span>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss install banner"
              className="text-blue-200 hover:text-white transition-colors p-1 rounded shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
