'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type DisplayMode = 'desktop' | 'mobile' | 'tv';

interface DisplayModeContextType {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
  gridClass: string;
}

const DisplayModeContext = createContext<DisplayModeContextType>({
  mode: 'desktop',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setMode: () => {},
  gridClass:
    'grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20',
});

export const useDisplayMode = () => useContext(DisplayModeContext);

const STORAGE_KEY = 'm2tv_display_mode';

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>('desktop');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DisplayMode | null;
      if (saved && ['desktop', 'mobile', 'tv'].includes(saved)) {
        setModeState(saved);
        document.documentElement.dataset.displayMode = saved;
      } else {
        // 如果没有存储，根据屏幕或 UA 进行初步判断
        const isTv =
          /SmartTV|Tizen|NetCast|WebOS|Android TV|GoogleTV|AppleTV|HbbTV|CrKey/i.test(
            navigator.userAgent
          );
        const initial = isTv ? 'tv' : 'desktop';
        setModeState(initial);
        document.documentElement.dataset.displayMode = initial;
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setMode = useCallback((newMode: DisplayMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.displayMode = newMode;
      }
    } catch {
      // ignore
    }
  }, []);

  // 根据当前模式返回网格样式类：
  // 1. tv 模式（電視縮小一半、密集顯示）：
  //    使用 minmax(95px, 1fr) 或 minmax(105px, 1fr)，在電視上可排列 6~10 張卡片，尺寸縮細一半！
  // 2. mobile 模式（電話模式）：
  //    緊湊 3 列或 2 列
  // 3. desktop 模式（標準電腦模式）：
  //    minmax(160px, 1fr)
  let gridClass =
    'grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20';

  if (mounted) {
    if (mode === 'tv') {
      // 電視緊湊模式：卡片縮細一半（約 95px ~ 110px 寬度，每行容納 6~8 張卡片），間距收窄
      gridClass =
        'grid grid-cols-6 sm:grid-cols-[repeat(auto-fill,minmax(95px,1fr))] gap-x-2 gap-y-6 sm:gap-x-3 sm:gap-y-8';
    } else if (mode === 'mobile') {
      // 電話模式：每行 3 張
      gridClass = 'grid grid-cols-3 gap-x-2 gap-y-8';
    } else {
      // 電腦模式：標準 160px
      gridClass =
        'grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20';
    }
  }

  return (
    <DisplayModeContext.Provider value={{ mode, setMode, gridClass }}>
      {children}
    </DisplayModeContext.Provider>
  );
}
