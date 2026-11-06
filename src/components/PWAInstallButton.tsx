import React, { useState } from 'react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { Smartphone, X, Download, CheckCircle2 } from 'lucide-react';

interface PWAInstallButtonProps {
  isDark?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ isDark = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running as an installed standalone Android/iOS app, hide the install button
  if (isInstalled) {
    return null;
  }

  const borderClass = isDark ? 'border-[#262626]' : 'border-[#E5E5E5]';
  const surfaceClass = isDark
    ? 'bg-[#121214] border-[#262626] text-zinc-100'
    : 'bg-white border-[#E5E5E5] text-zinc-900';
  const subtleSurfaceClass = isDark
    ? 'bg-[#18181B] border-[#262626]'
    : 'bg-[#F4F4F5] border-[#E5E5E5]';
  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
        title="Install Android / Mobile App"
      >
        <Smartphone className="w-3.5 h-3.5 stroke-[2.2]" />
        <span className="hidden sm:inline">Install </span>
        <span>App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md rounded-lg border p-6 shadow-2xl space-y-4 ${surfaceClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${borderClass}`}>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-medium tracking-tight">
                  Install on Your Android or iOS Phone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className={`${textMuted} hover:text-inherit p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs leading-relaxed">
                <p className={textMuted}>
                  To install <strong>Hvr Expense Manager</strong> on your iPhone or iPad:
                </p>
                <ol className={`space-y-2 p-3.5 rounded-md border ${subtleSurfaceClass}`}>
                  <li>1. Open this app URL in <strong>Safari</strong>.</li>
                  <li>2. Tap the <strong>Share</strong> icon at the bottom of the screen.</li>
                  <li>3. Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed">
                <p className={textMuted}>
                  This app is configured as a standalone <strong>Android WebAPK / PWA</strong> with offline support:
                </p>
                <div className={`space-y-2.5 p-3.5 rounded-md border ${subtleSurfaceClass}`}>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Option 1 (Direct Chrome Install):</strong> Open your published URL in <strong>Chrome on Android</strong>, tap the menu (<strong>⋮</strong>) in the top-right corner, and tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Download className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Option 2 (Download .APK file):</strong> Paste your GitHub Pages URL into{' '}
                      <a
                        href="https://www.pwabuilder.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-500 underline font-medium"
                      >
                        PWABuilder.com
                      </a>{' '}
                      and click <strong>Package for Store &rarr; Android &rarr; Download APK</strong> to get a standalone `.apk` installer file.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={`pt-3 border-t ${borderClass} flex justify-end`}>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-zinc-950 animate-pulse" />
      Offline Mode — Expenses are saved locally on your device.
    </div>
  );
};
