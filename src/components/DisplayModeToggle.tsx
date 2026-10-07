'use client';

import { Laptop, MonitorPlay, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { DisplayMode, useDisplayMode } from './DisplayModeContext';

export function DisplayModeToggle() {
  const { mode, setMode } = useDisplayMode();
  const [isOpen, setIsOpen] = useState(false);

  const options: Array<{
    key: DisplayMode;
    label: string;
    subLabel: string;
    icon: typeof Laptop;
  }> = [
    {
      key: 'desktop',
      label: '電腦模式',
      subLabel: '標準尺寸 (160px)',
      icon: Laptop,
    },
    {
      key: 'tv',
      label: '電視模式',
      subLabel: '卡片縮細一半 (密集多列)',
      icon: MonitorPlay,
    },
    {
      key: 'mobile',
      label: '電話模式',
      subLabel: '便攜 3 列',
      icon: Smartphone,
    },
  ];

  const currentOption = options.find((o) => o.key === mode) || options[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
        title={`當前顯示模式：${currentOption.label}`}
        aria-label='Toggle display mode'
      >
        <CurrentIcon className='w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400' />
      </button>

      {isOpen && (
        <>
          {/* 背景遮罩，點擊關閉 */}
          <div
            className='fixed inset-0 z-40'
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉面板 */}
          <div className='absolute right-0 mt-2 w-52 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 py-2 z-50 animate-in fade-in zoom-in-95 duration-150'>
            <div className='px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 mb-1'>
              顯示模式 (熒幕大小)
            </div>
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  type='button'
                  onClick={() => {
                    setMode(opt.key);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-green-50/80 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400'
                    }`}
                  />
                  <div className='flex flex-col min-w-0'>
                    <span className='text-xs font-medium'>{opt.label}</span>
                    <span className='text-[10px] text-gray-400 dark:text-gray-500 truncate'>
                      {opt.subLabel}
                    </span>
                  </div>
                  {isSelected && (
                    <span className='ml-auto w-1.5 h-1.5 rounded-full bg-green-500' />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
