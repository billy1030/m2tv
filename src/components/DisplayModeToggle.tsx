'use client';

import { Laptop, MonitorPlay, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { DisplayMode, useDisplayMode } from './DisplayModeContext';

export function DisplayModeToggle() {
  const { mode, setMode } = useDisplayMode();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const menuPanel = (
    <>
      {/* 背景遮罩 - 普通菜单无需模糊 */}
      <div
        className='fixed inset-0 bg-transparent z-[1000]'
        onClick={() => setIsOpen(false)}
      />

      {/* 菜单面板 - 与 UserMenu 位置与样式风格统一 */}
      <div className='fixed top-14 right-4 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl z-[1001] border border-gray-200/50 dark:border-gray-700/50 overflow-hidden select-none'>
        <div className='px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-800/50'>
          <span className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
            顯示模式 (熒幕大小)
          </span>
        </div>
        <div className='py-1'>
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
                className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors text-sm ${
                  isSelected
                    ? 'bg-green-50/80 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-500'
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
      </div>
    </>
  );

  return (
    <>
      <div className='relative'>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
          title={`當前顯示模式：${currentOption.label}`}
          aria-label='Toggle display mode'
        >
          <CurrentIcon className='w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400' />
        </button>
      </div>

      {isOpen && mounted && createPortal(menuPanel, document.body)}
    </>
  );
}
