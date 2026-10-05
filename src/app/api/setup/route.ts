/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig, updateDynamicConfig } from '@/lib/config';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

export async function GET(_request: NextRequest) {
  try {
    const config = await getConfig();
    const sourceCount =
      config?.SourceConfig?.filter((s) => !s.disabled)?.length || 0;
    const totalSources = config?.SourceConfig?.length || 0;

    return NextResponse.json({
      siteName: config?.SiteConfig?.SiteName || 'm2tv',
      totalSources,
      activeSources: sourceCount,
      cacheTime: config?.SiteConfig?.SiteInterfaceCacheTime || 7200,
      customCategoriesCount: config?.CustomCategories?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取基础信息失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-setup-key') || '';
    const envPassword = process.env.PASSWORD || '$$$$$$$$';

    // Require either matching password or matching owner key
    if (envPassword) {
      if (!authHeader || authHeader.trim() !== envPassword.trim()) {
        console.log(
          `[setup auth] mismatch: header len=${authHeader.length}, env len=${envPassword.length}`
        );
        return NextResponse.json(
          { error: '访问口令无效或未提供，请输入正确的站点访问密码' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '无效的 JSON 内容' }, { status: 400 });
    }

    const currentConfig = await getConfig();

    let importedCount = 0;

    // Format 1: config.json format { api_site: {...}, cache_time?: number, custom_category?: [...] }
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
      importedCount = newSources.length;

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
      // Format 2: Full AdminConfig
      if (body.SiteConfig) {
        currentConfig.SiteConfig = {
          ...currentConfig.SiteConfig,
          ...body.SiteConfig,
        };
      }
      if (Array.isArray(body.SourceConfig)) {
        currentConfig.SourceConfig = body.SourceConfig;
        importedCount = body.SourceConfig.length;
      }
      if (Array.isArray(body.CustomCategories)) {
        currentConfig.CustomCategories = body.CustomCategories;
      }
    } else {
      return NextResponse.json(
        {
          error:
            '不支持的文件结构。请上传包含 api_site 或 SourceConfig 的 JSON 配置文件。',
        },
        { status: 400 }
      );
    }

    // Persist to storage and memory/disk
    const storage = getStorage();
    if (storage && typeof (storage as any).setAdminConfig === 'function') {
      await (storage as any).setAdminConfig(currentConfig);
    }

    await updateDynamicConfig(currentConfig);

    return NextResponse.json({
      ok: true,
      message: `配置成功导入并已立即生效！共加载 ${importedCount} 个视频源节点。`,
      importedCount,
    });
  } catch (error) {
    console.error('配置导入异常:', error);
    return NextResponse.json(
      { error: '导入失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
