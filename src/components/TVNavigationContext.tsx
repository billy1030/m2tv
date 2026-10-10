'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface TVNavigationContextType {
  isTVMode: boolean;
  setIsTVMode: (val: boolean) => void;
}

const TVNavigationContext = createContext<TVNavigationContextType>({
  isTVMode: false,
  setIsTVMode: () => undefined,
});

export const useTVNavigation = () => useContext(TVNavigationContext);

// Android TV / D-Pad key codes
const TV_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Select',
  'Backspace',
  'Escape',
];

export const TVNavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isTVMode, setIsTVMode] = useState<boolean>(false);

  useEffect(() => {
    // If running in Android TV WebView with specific UA, or on first D-Pad key press
    const handleKeyDown = (e: KeyboardEvent) => {
      if (TV_KEYS.includes(e.key)) {
        if (!isTVMode) {
          setIsTVMode(true);
          document.body.classList.add('tv-mode');
        }

        // Handle Back navigation if on Android TV remote Back / Escape
        if (e.key === 'Escape') {
          // If in fullscreen or modal, let normal handlers take it, else history back
          if (!document.fullscreenElement && window.history.length > 1) {
            // Can be intercepted by specific page if needed
          }
        }
      }
    };

    const handleMouseMove = () => {
      // If user uses mouse, disable TV focus highlight
      if (isTVMode) {
        setIsTVMode(false);
        document.body.classList.remove('tv-mode');
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isTVMode]);

  return (
    <TVNavigationContext.Provider value={{ isTVMode, setIsTVMode }}>
      {children}
    </TVNavigationContext.Provider>
  );
};
