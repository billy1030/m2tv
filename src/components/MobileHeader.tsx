'use client';

import { HardDriveUpload } from 'lucide-react';
import Link from 'next/link';

import { BackButton } from './BackButton';
import { DisplayModeToggle } from './DisplayModeToggle';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
}

const MobileHeader = ({ showBackButton = false }: MobileHeaderProps) => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden relative w-full bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/70 dark:border-gray-700/50'>
      <div className='h-12 flex items-center justify-between px-3'>
        {/* 左侧：Logo 与 返回按钮 */}
        <div className='flex items-center gap-2'>
          {showBackButton && <BackButton />}
          <Link
            href='/'
            className='text-xl font-bold text-green-600 tracking-tight hover:opacity-80 transition-opacity'
          >
            {siteName}
          </Link>
        </div>

        {/* 右侧按钮 */}
        <div className='flex items-center gap-1.5'>
          <Link
            href='/setup'
            className='p-1.5 rounded-full text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'
            title='配置向导'
            aria-label='Setup'
          >
            <HardDriveUpload className='w-5 h-5' />
          </Link>
          <DisplayModeToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
