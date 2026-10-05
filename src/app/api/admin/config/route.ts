/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, updateDynamicConfig } from '@/lib/config';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // localstorage 模式下只要密码正确即可
  if (storageType === 'localstorage') {
    const effectivePassword = process.env.PASSWORD || '$$$$$$$$';
    if (!authInfo.password || authInfo.password !== effectivePassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    if (!authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const username = authInfo.username || 'admin';

  try {
    const config = await getConfig();
    const result: AdminConfigResult = {
      Role: 'owner',
      Config: config,
    };
    if (storageType === 'localstorage' || username === process.env.USERNAME) {
      result.Role = 'owner';
    } else {
      const user = config.UserConfig?.Users?.find(
        (u) => u.username === username
      );
      if (user && user.role === 'admin') {
        result.Role = 'admin';
      } else {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (storageType === 'localstorage') {
    const effectivePassword = process.env.PASSWORD || '$$$$$$$$';
    if (!authInfo.password || authInfo.password !== effectivePassword) {
      return NextResponse.json({ error: '密码错误或未授权' }, { status: 401 });
    }
  } else {
    if (!authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authInfo.username !== process.env.USERNAME) {
      return NextResponse.json(
        { error: '仅站长有权导入/更新全局配置' },
        { status: 403 }
      );
    }
  }

  try {
    const body = await request.json();
    const currentConfig = await getConfig();
    const storage = getStorage();

    // Check if uploaded format is config.json format { api_site: {...}, cache_time: ... }
    if (body.api_site && typeof body.api_site === 'object') {
      const newSources = Object.entries(body.api_site).map(
        ([key, item]: [string, any]) => ({
          key,
          name: item.name || key,
          api: item.api,
          detail: item.detail,
          from: 'config' as const,
          disabled: false,
        })
      );
      currentConfig.SourceConfig = newSources;
      if (body.cache_time) {
        currentConfig.SiteConfig.SiteInterfaceCacheTime = Number(
          body.cache_time
        );
      }
      if (Array.isArray(body.custom_category)) {
        currentConfig.CustomCategories = body.custom_category.map((c: any) => ({
          name: c.name,
          type: c.type,
          query: c.query,
          from: 'config' as const,
          disabled: false,
        }));
      }
    } else if (body.SiteConfig || body.SourceConfig) {
      // Direct AdminConfig format
      if (body.SiteConfig) {
        currentConfig.SiteConfig = {
          ...currentConfig.SiteConfig,
          ...body.SiteConfig,
        };
      }
      if (Array.isArray(body.SourceConfig)) {
        currentConfig.SourceConfig = body.SourceConfig;
      }
      if (Array.isArray(body.CustomCategories)) {
        currentConfig.CustomCategories = body.CustomCategories;
      }
    } else {
      return NextResponse.json(
        { error: '无效的配置文件格式' },
        { status: 400 }
      );
    }

    if (storage && typeof (storage as any).setAdminConfig === 'function') {
      await (storage as any).setAdminConfig(currentConfig);
    }
    await updateDynamicConfig(currentConfig);

    return NextResponse.json({ ok: true, message: '配置导入成功' });
  } catch (error) {
    console.error('导入配置失败:', error);
    return NextResponse.json(
      { error: '导入配置失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
