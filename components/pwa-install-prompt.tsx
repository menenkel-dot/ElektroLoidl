'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'volt-time-install-hint-dismissed';
const subscribeToClient = () => () => undefined;

function isStandaloneMode() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const isIos = isClient && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInstalled = isClient && isStandaloneMode();
  const wasDismissed = isDismissed || (isClient && localStorage.getItem(DISMISS_KEY) === 'true');

  useEffect(() => {
    if (isStandaloneMode() || localStorage.getItem(DISMISS_KEY) === 'true') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setIsDismissed(true);
  };

  const install = async () => {
    if (isIos) {
      setShowInstallHelp(true);
      return;
    }

    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!isClient || isInstalled || wasDismissed) return null;

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 sm:px-8 transition-colors">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 text-sm">
        <div className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
          <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div>
            <p>
              Diese App kann auf diesem Gerät installiert werden.
              {' '}
              <button type="button" onClick={install} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                {installPrompt ? 'Jetzt installieren' : 'So geht’s'}
              </button>
            </p>
            {showInstallHelp && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Share className="h-3.5 w-3.5" aria-hidden="true" />
                {isIos
                  ? 'In Safari „Teilen“ öffnen und „Zum Home-Bildschirm“ wählen.'
                  : 'Im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.'}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={dismiss} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Installationshinweis schließen">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
