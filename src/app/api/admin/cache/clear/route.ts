/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearCachedConfig, getConfig } from '@/lib/config';

import { clearSiteClassCache } from '@/app/api/vod/list/route';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 验证管理员身份
  if (storageType === 'localstorage') {
    const effectivePassword = process.env.PASSWORD || '$$$$$$$$';
    if (!authInfo.password || authInfo.password !== effectivePassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    if (!authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;
    if (username !== process.env.USERNAME) {
      const config = await getConfig();
      const user = config.UserConfig?.Users?.find(
        (u) => u.username === username
      );
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }
  }

  try {
    // 1. 清理服务端内存配置缓存与分类缓存
    clearCachedConfig();
    clearSiteClassCache();

    // 2. 返回带清空缓存指令的响应头
    return NextResponse.json(
      {
        ok: true,
        message: '缓存已重置',
        timestamp: Date.now(),
      },
      {
        headers: {
          'Clear-Site-Data': '"cache"',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('清除缓存失败:', error);
    return NextResponse.json(
      {
        error: '清除缓存失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
