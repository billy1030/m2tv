'use client';

import { Copy } from 'lucide-react';
import React, { useState } from 'react';

import { useDisplayMode } from './DisplayModeContext';

export function CopyLinkModeToggle() {
  const { mode, copyLinkMode, toggleCopyLinkMode } = useDisplayMode();
  const [showTooltip, setShowTooltip] = useState(false);

  // 仅在电脑模式（desktop）下显示该图标
  if (mode !== 'desktop') {
    return null;
  }

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={toggleCopyLinkMode}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-10 h-10 p-2 rounded-full flex items-center justify-center transition-all ${
          copyLinkMode
            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-600'
            : 'text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 hover:text-amber-600 dark:hover:text-amber-400'
        }`}
        title={
          copyLinkMode ? '複製連結模式（已開啟，點擊關閉）' : '開啟複製連結模式'
        }
        aria-label='Toggle copy link mode'
        aria-pressed={copyLinkMode}
      >
        {copyLinkMode ? (
          <Copy className='w-5 h-5 text-white animate-in zoom-in-75 duration-150' />
        ) : (
          <Copy className='w-5 h-5' />
        )}
      </button>

      {/* 氣泡提示 */}
      {showTooltip && (
        <div className='absolute right-0 top-12 whitespace-nowrap z-50 px-2.5 py-1 text-xs font-medium rounded-md shadow-lg pointer-events-none bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 animate-in fade-in slide-in-from-top-1'>
          {copyLinkMode ? '點擊關閉複製連結模式' : '開啟複製連結模式'}
        </div>
      )}
    </div>
  );
}
