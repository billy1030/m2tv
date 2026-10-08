/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'edge';

// 标准化映射常用地区代码，便于在片库中直接点击索取
const AREA_TO_PARAM: Record<string, string> = {
  大陆: 'cn',
  中国大陆: 'cn',
  内地: 'cn',
  香港: 'hk',
  中国香港: 'hk',
  台湾: 'tw',
  中国台湾: 'tw',
  日本: 'jp',
  韩国: 'kr',
  美国: 'us',
  泰国: 'overseas',
  英国: 'overseas',
  法国: 'overseas',
  加拿大: 'overseas',
  德国: 'overseas',
  俄罗斯: 'overseas',
};

// 标准化常见片种到片库检索 type 参数
const TYPE_TO_PARAM: Record<string, string> = {
  短剧: 'duanju',
  短劇: 'duanju',
  AI短剧: 'duanju',
  AI漫剧: 'duanju',
  漫剧: 'duanju',
  现代都市: 'duanju',
  现代言情: 'duanju',
  都市生活: 'duanju',
  反转爽文: 'duanju',
  反转爽剧: 'duanju',
  言情总裁: 'duanju',
  电影: 'movie',
  動作片: 'action',
  动作片: 'action',
  喜劇片: 'comedy',
  喜剧片: 'comedy',
  愛情片: 'romance',
  爱情片: 'romance',
  科幻片: 'scifi',
  恐怖片: 'horror',
  戰爭片: 'war',
  战争片: 'war',
  懸疑片: 'suspense',
  悬疑片: 'suspense',
  紀錄片: 'doc',
  纪录片: 'doc',
  連續劇: 'tv',
  电视剧: 'tv',
  電視劇: 'tv',
  国产剧: 'tv',
  香港剧: 'tv',
  港剧: 'tv',
  韩剧: 'tv',
  韩国剧: 'tv',
  日剧: 'tv',
  美剧: 'tv',
  欧美剧: 'tv',
  泰剧: 'tv',
  动漫: 'anime',
  動漫: 'anime',
  国产动漫: 'anime',
  日韩动漫: 'anime',
  日本动漫: 'anime',
  欧美动漫: 'anime',
  动画片: 'anime',
  综艺: 'variety',
  綜藝: 'variety',
  大陆综艺: 'variety',
  港台综艺: 'variety',
  日韩综艺: 'variety',
  欧美综艺: 'variety',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sampleLimit = Math.min(
    1500,
    Math.max(200, parseInt(searchParams.get('limit') || '1000', 10))
  );

  try {
    const apiSites = await getAvailableApiSites();
    if (apiSites.length === 0) {
      return NextResponse.json({ error: '无可用节点' }, { status: 400 });
    }

    const primarySites = apiSites.slice(0, 5);
    const pagesPerSite = Math.ceil(sampleLimit / (primarySites.length * 20));

    const tasks: Promise<any>[] = [];
    for (const site of primarySites) {
      const sep = site.api.includes('?') ? '&' : '?';
      for (let p = 1; p <= pagesPerSite; p++) {
        tasks.push(
          (async () => {
            try {
              const res = await fetch(`${site.api}${sep}ac=detail&pg=${p}`, {
                signal: AbortSignal.timeout(5000),
                headers: { 'User-Agent': 'Mozilla/5.0' },
              });
              if (!res.ok) return [];
              const data = await res.json();
              return (data.list || []).map((item: any) => ({
                ...item,
                _siteName: site.name,
              }));
            } catch {
              return [];
            }
          })()
        );
      }
    }

    const batchResults = await Promise.all(tasks);
    const rawList = batchResults.flat();

    const areaMap = new Map<string, { count: number; param: string }>();
    const typeMap = new Map<string, { count: number; param: string }>();
    const yearMap = new Map<string, { count: number; param: string }>();
    const siteMap = new Map<string, number>();

    const dedupeSet = new Set<string>();
    let validSampleCount = 0;

    for (const item of rawList) {
      if (validSampleCount >= sampleLimit) break;

      const name = (item.vod_name || '').trim();
      const rawYear = (item.vod_year || '').trim();
      const cleanYear = rawYear.match(/\d{4}/)?.[0] || rawYear || '未知';
      const key = `${name.toLowerCase()}-${cleanYear}`;
      if (dedupeSet.has(key)) continue;
      dedupeSet.add(key);

      const typeName = (item.type_name || '').trim();
      if (yellowWords.some((w: string) => typeName.includes(w))) continue;

      const area = (item.vod_area || '未知').trim();
      validSampleCount++;

      // 统计地区
      if (area && area !== '未知') {
        const current = areaMap.get(area) || {
          count: 0,
          param: AREA_TO_PARAM[area] || '',
        };
        current.count++;
        areaMap.set(area, current);
      }

      // 统计片种类型
      if (typeName && typeName !== '未知') {
        const current = typeMap.get(typeName) || {
          count: 0,
          param: TYPE_TO_PARAM[typeName] || '',
        };
        current.count++;
        typeMap.set(typeName, current);
      }

      // 统计年份
      if (cleanYear && cleanYear !== '未知') {
        const current = yearMap.get(cleanYear) || {
          count: 0,
          param: cleanYear,
        };
        current.count++;
        yearMap.set(cleanYear, current);
      }

      // 统计节点来源
      if (item._siteName) {
        siteMap.set(item._siteName, (siteMap.get(item._siteName) || 0) + 1);
      }
    }

    const sortEntries = (
      m: Map<string, { count: number; param: string }>,
      limit = 15
    ) =>
      Array.from(m.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          percentage: Number(
            ((data.count / validSampleCount) * 100).toFixed(1)
          ),
          param: data.param,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        sampleCount: validSampleCount,
        targetLimit: sampleLimit,
        areas: sortEntries(areaMap, 12),
        types: sortEntries(typeMap, 16),
        years: sortEntries(yearMap, 10),
        sites: Array.from(siteMap.entries())
          .map(([name, count]) => ({
            name,
            count,
            percentage: Number(((count / validSampleCount) * 100).toFixed(1)),
          }))
          .sort((a, b) => b.count - a.count),
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${Math.min(
            cacheTime,
            1800
          )}, s-maxage=${Math.min(cacheTime, 1800)}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
