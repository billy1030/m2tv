'use client';

import { Copy, Laptop, MonitorPlay, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { DisplayMode, useDisplayMode } from './DisplayModeContext';

export function DisplayModeToggle() {
  const { mode, setMode, copyLinkMode, toggleCopyLinkMode } = useDisplayMode();
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
        {mode === 'desktop' && (
          <div className='py-1 border-t border-gray-100 dark:border-gray-800'>
            <button
              type='button'
              onClick={() => {
                toggleCopyLinkMode();
              }}
              className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors text-sm ${
                copyLinkMode
                  ? 'bg-amber-50/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className='flex items-center gap-2.5 min-w-0'>
                <Copy
                  className={`w-4 h-4 shrink-0 ${
                    copyLinkMode
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <div className='flex flex-col min-w-0'>
                  <span className='text-xs font-medium'>複製連結模式</span>
                  <span className='text-[10px] text-gray-400 dark:text-gray-500 truncate'>
                    {copyLinkMode
                      ? '已開啟（點擊複製連結）'
                      : '點擊卡片左上角按鈕複製'}
                  </span>
                </div>
              </div>
              <div
                className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  copyLinkMode ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    copyLinkMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className='relative'>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors relative'
          title={`當前顯示模式：${currentOption.label}${
            copyLinkMode ? '（已開啟複製連結模式）' : ''
          }`}
          aria-label='Toggle display mode'
        >
          <CurrentIcon className='w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400' />
          {mode === 'desktop' && copyLinkMode && (
            <span className='absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-900' />
          )}
        </button>
      </div>

      {isOpen && mounted && createPortal(menuPanel, document.body)}
    </>
  );
}
