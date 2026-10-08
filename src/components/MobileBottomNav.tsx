/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Clover,
  Database,
  Film,
  Flame,
  Home,
  Search,
  Sparkles,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器完整路径
  const currentActive =
    activePath ??
    (() => {
      const queryString = searchParams?.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    })();

  const navItems = [
    { icon: Home, label: '首頁', href: '/' },
    { icon: Search, label: '搜尋', href: '/search' },
    {
      icon: Film,
      label: '電影',
      href: '/library?type=movie',
    },
    {
      icon: Tv,
      label: '劇集',
      href: '/library?type=tv',
    },
    {
      icon: Clover,
      label: '綜藝',
      href: '/library?type=variety',
    },
    {
      icon: Flame,
      label: '短劇',
      href: '/library?type=duanju',
    },
    {
      icon: Sparkles,
      label: '動漫',
      href: '/library?type=anime',
    },
    {
      icon: Database,
      label: '片庫直連',
      href: '/library',
    },
  ];

  const isActive = (href: string) => {
    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    if (decodedActive === decodedItemHref) {
      return true;
    }

    const typeMatch = href.match(/type=([^&]+)/)?.[1];
    if (typeMatch) {
      return (
        decodedActive.includes(`type=${typeMatch}`) &&
        decodedActive.startsWith(href.split('?')[0])
      );
    }

    return false;
  };

  return (
    <nav
      className='md:hidden fixed left-0 right-0 z-[600] bg-white/90 backdrop-blur-xl border-t border-gray-200/50 dark:bg-gray-900/85 dark:border-gray-700/50'
      style={{
        /* 紧贴视口底部，同时在内部留出安全区高度 */
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 'calc(3.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <ul
        className='flex items-center overflow-x-auto scrollbar-hide px-1 py-1 touch-pan-x overscroll-contain'
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className='flex-shrink-0'>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[4.25rem] px-2.5 h-12 gap-0.5 text-xs rounded-lg transition-colors duration-200 ${
                  active
                    ? 'text-green-600 dark:text-green-400 font-medium'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <item.icon
                  className={`h-5 w-5 ${
                    active
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span className='whitespace-nowrap text-[11px] leading-tight'>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
