/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { cleanHtmlTags } from '@/lib/utils';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'edge';

// 目标聚合数量：每次精确返回 100 部去重/聚合后的影片
const TARGET_ITEMS_PER_BATCH = 100;
// 单次从各采集站分页拉取页数（当有具体筛选条件如地区时，拉取 6 页以保证凑齐 100 部）
const PAGES_PER_FETCH = 6;

// 片种类别的关键词映射（支持简体与繁体双向对齐）
const GENRE_MAP: Record<string, string[]> = {
  // 细分子片种
  comedy: ['喜剧', '喜劇', '喜剧片', '喜劇片'],
  horror: ['恐怖', '惊悚', '驚悚', '恐怖片'],
  suspense: [
    '悬疑',
    '懸疑',
    '犯罪',
    '罪案',
    '悬疑片',
    '懸疑片',
    '犯罪片',
    '侦探',
    '偵探',
  ],
  scifi: ['科幻', '科幻片', '奇幻'],
  action: ['动作', '動作', '动作片', '動作片'],
  wuxia: [
    '武侠',
    '武俠',
    '古装',
    '古裝',
    '古装武侠',
    '古裝武俠',
    '仙侠',
    '仙俠',
  ],
  romance: ['爱情', '愛情', '爱情片', '愛情片', '言情'],
  war: ['战争', '戰爭', '战争片', '戰爭片', '军旅', '軍旅'],
  drama: ['剧情', '劇情', '剧情片', '劇情片'],
  doc: ['纪录', '紀錄', '纪录片', '紀錄片', '记录片', '記錄片'],
  // 短劇細分題材子類（對齊各節點原生短劇分類，雙向繁簡體）
  duanju_modern: [
    '现代都市',
    '現代都市',
    '现代言情',
    '現代言情',
    '都市生活',
    '都市脑洞',
    '都市腦洞',
    '都市',
  ],
  duanju_ceo: [
    '言情总裁',
    '言情總裁',
    '总裁',
    '總裁',
    '女恋总裁',
    '女戀總裁',
    '豪门',
    '豪門',
    '闪婚离婚',
    '閃婚離婚',
    '甜宠',
    '甜寵',
  ],
  duanju_time: ['穿越年代', '年代穿越', '穿越现代', '穿越現代', '年代'],
  duanju_rebirth: ['重生民国', '重生民國', '重生', '重生逆袭', '重生逆襲'],
  duanju_ai: [
    'AI漫剧',
    'AI漫劇',
    'AI短剧',
    'AI短劇',
    '漫剧',
    '漫劇',
    'AI动漫',
    'AI動漫',
  ],
  duanju_twist: [
    '反转爽剧',
    '反轉爽劇',
    '反转爽文',
    '反轉爽文',
    '爽文短剧',
    '爽文短劇',
    '逆袭',
    '逆襲',
    '反转',
    '反轉',
  ],
  // 大类
  duanju: [
    '短剧',
    '短劇',
    '爽文',
    '反转爽文',
    '反轉爽文',
    '反转爽剧',
    '反轉爽劇',
    '总裁',
    '總裁',
    '女恋总裁',
    '女戀總裁',
    '言情总裁',
    '言情總裁',
    '重生民国',
    '重生民國',
    '穿越年代',
    '现代都市',
    '現代都市',
    '现代言情',
    '現代言情',
    '闪婚离婚',
    '閃婚離婚',
    '都市脑洞',
    '都市腦洞',
    'AI漫剧',
    'AI漫劇',
    '漫剧',
    '漫劇',
    '战神',
    '戰神',
  ],
  movie: [
    '电影',
    '電影',
    '电影片',
    '電影片',
    '动作片',
    '動作片',
    '喜剧片',
    '喜劇片',
    '爱情片',
    '愛情片',
    '科幻片',
    '恐怖片',
    '剧情片',
    '劇情片',
    '战争片',
    '戰爭片',
    '纪录片',
    '紀錄片',
  ],
  tv: [
    '电视剧',
    '電視劇',
    '连续剧',
    '連續劇',
    '国产剧',
    '國產劇',
    '香港剧',
    '香港劇',
    '港剧',
    '港劇',
    '韩国剧',
    '韓國劇',
    '韩剧',
    '韓劇',
    '欧美剧',
    '歐美劇',
    '美剧',
    '美劇',
    '日剧',
    '日劇',
    '日本剧',
    '日本劇',
    '泰剧',
    '泰劇',
  ],
  anime: [
    '动漫',
    '動漫',
    '动漫片',
    '動漫片',
    '国产动漫',
    '國產動漫',
    '日韩动漫',
    '日韓動漫',
    '日本动漫',
    '日本動漫',
    '欧美动漫',
    '歐美動漫',
    '港台动漫',
    '港台動漫',
    '海外动漫',
    '海外動漫',
    '动画片',
    '動畫片',
    '动漫电影',
    '動漫電影',
  ],
  variety: [
    '综艺',
    '綜藝',
    '综艺片',
    '綜藝片',
    '大陆综艺',
    '大陸綜藝',
    '港台综艺',
    '港台綜藝',
    '日韩综艺',
    '日韓綜藝',
    '欧美综艺',
    '歐美綜藝',
  ],
};

// 地区过滤映射（精准对齐采集站原生简体词）
const AREA_MAP: Record<string, string[]> = {
  cn: ['大陆', '中国大陆', '国产', '内地'],
  hk: ['香港', '中国香港', '港剧', '香港剧', '港台'],
  tw: ['台湾', '中国台湾', '台剧'],
  jp: ['日本', '日漫', '日剧'],
  kr: ['韩国', '韩剧', '韩国剧'],
  us: ['美国', '美剧', '美'],
  overseas: [
    '海外',
    '泰国',
    '英国',
    '法国',
    '意大利',
    '加拿大',
    '德国',
    '俄罗斯',
    '西班牙',
    '海外剧',
    '海外动漫',
  ],
};

// 缓存各节点的分类列表以获取 type_id
const siteClassCache = new Map<
  string,
  Array<{ type_id: number; type_name: string }>
>();

async function getSiteClasses(
  site: any
): Promise<Array<{ type_id: number; type_name: string }>> {
  const cached = siteClassCache.get(site.key);
  if (cached) {
    return cached;
  }
  try {
    const sep = site.api.includes('?') ? '&' : '?';
    const res = await fetch(`${site.api}${sep}ac=list`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.class || [];
    siteClassCache.set(site.key, list);
    return list;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batch = parseInt(
    searchParams.get('batch') || searchParams.get('page') || '1',
    10
  );
  const year = searchParams.get('year') || '';
  const genreKey = searchParams.get('type') || '';
  const areaKey = searchParams.get('area') || ''; // cn, us, jp, kr, hk, tw, th 或空

  try {
    const apiSites = await getAvailableApiSites();
    if (apiSites.length === 0) {
      return NextResponse.json(
        { error: '没有可用的资源节点' },
        { status: 400 }
      );
    }

    const primarySites = apiSites.slice(0, 3);
    const startPg = (batch - 1) * PAGES_PER_FETCH + 1;

    // 为每个节点查找目标类型的对应 type_id 列表
    // 说明：采集站的大类（如「电视剧」、「动漫」）或指定地区时，海量数据分散在各区域子分类中（如「国产剧」、「香港剧」、「台湾剧」、「国产动漫」、「港台综艺」等）
    const targetTypeMap = new Map<string, number[]>();
    const allowedWords =
      genreKey && GENRE_MAP[genreKey] ? GENRE_MAP[genreKey] : [];
    const regionalWords = areaKey && AREA_MAP[areaKey] ? AREA_MAP[areaKey] : [];

    if (allowedWords.length > 0 || regionalWords.length > 0) {
      await Promise.all(
        primarySites.map(async (site) => {
          const classes = await getSiteClasses(site);
          let matchedIds: number[] = [];

          // 1. 如果指定了地区（如日本/大陆/台湾/美国/海外等）
          if (regionalWords.length > 0) {
            const matched = classes.filter((c) => {
              const name = c.type_name;
              // 如果同时指定了类型（如电视剧、动漫、综艺等），类型需相符
              const matchesGenre =
                allowedWords.length === 0 ||
                allowedWords.some((w) => name.includes(w));
              const matchesArea = regionalWords.some((rw) => name.includes(rw));
              return matchesGenre && matchesArea;
            });
            matchedIds = matched.map((c) => c.type_id);
          }

          // 2. 如果未限定地区，或者指定类型在大类中（如动漫/电影等）：
          if (matchedIds.length === 0 && allowedWords.length > 0) {
            if (genreKey === 'anime') {
              // 动漫大类：采集站的大类「动漫片」(53部)是空的容器，真正数据在各子分类中，故收录所有子类
              const matched = classes.filter((c) =>
                allowedWords.some((w) => c.type_name.includes(w))
              );
              matchedIds = matched.map((c) => c.type_id);
            } else {
              // 其他分类优先单一大类
              const singleMatched = classes.find((c) =>
                allowedWords.some((w) => c.type_name.includes(w))
              );
              if (singleMatched) {
                matchedIds = [singleMatched.type_id];
              }
            }
          }

          if (matchedIds.length > 0) {
            targetTypeMap.set(site.key, matchedIds);
          }
        })
      );
    }

    // 并行抓取主节点的页码数据
    const fetchPromises: Promise<any>[] = [];

    for (const site of primarySites) {
      const sep = site.api.includes('?') ? '&' : '?';
      const typeIds = targetTypeMap.get(site.key);

      // 如果有子分类列表（例如动漫的多子类），遍历请求各子分类
      const idsToFetch = typeIds && typeIds.length > 0 ? typeIds : [null];

      for (const tId of idsToFetch) {
        // 如果是多子类并发，每个子类取 1~2 页即可凑齐 100 部；如果是单分类，则取 PAGES_PER_FETCH 页
        const effectivePages =
          idsToFetch.length > 1
            ? Math.min(2, PAGES_PER_FETCH)
            : PAGES_PER_FETCH;
        const subStartPg =
          idsToFetch.length > 1 ? (batch - 1) * effectivePages + 1 : startPg;
        const subEndPg = subStartPg + effectivePages - 1;

        // 计算需要向采集站请求的年份列表
        // 注意：采集站只能接收单一具体年份（如 &year=2026 或 &year=2018）。若不传 year，前几页全都是最新片（2026年），根本无法得到 2015~2019 或 2010 年前的片子！
        let yearsToFetch: (string | null)[] = [null];
        if (year) {
          if (/^\d{4}$/.test(year)) {
            yearsToFetch = [year];
          } else if (year === 'earlier') {
            // 2020 年前：采样代表性年份
            yearsToFetch = ['2019', '2018', '2016', '2014', '2010', '2005'];
          } else if (year.includes('-')) {
            const [startYear, endYear] = year
              .split('-')
              .map((v) => parseInt(v, 10));
            yearsToFetch = [];
            for (let y = endYear; y >= startYear; y--) {
              yearsToFetch.push(String(y));
            }
          }
        }

        for (let p = subStartPg; p <= subEndPg; p++) {
          for (const yr of yearsToFetch) {
            let fetchUrl = `${site.api}${sep}ac=detail&pg=${p}`;
            if (yr) fetchUrl += `&year=${encodeURIComponent(yr)}`;
            if (tId) fetchUrl += `&t=${tId}`;

            fetchPromises.push(
              (async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 6500);
                try {
                  const res = await fetch(fetchUrl, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                  });
                  clearTimeout(timer);
                  if (!res.ok) return null;
                  const json = await res.json();
                  return {
                    site,
                    list: json.list || [],
                    total: json.total || json.recordcount || 0,
                  };
                } catch {
                  clearTimeout(timer);
                  return null;
                }
              })()
            );
          }
        }
      }
    }

    const fetchedResults = await Promise.all(fetchPromises);
    const validResults = fetchedResults.filter(Boolean);

    let maxTotal = 0;
    const rawList: any[] = [];
    validResults.forEach((res) => {
      if (res.total > maxTotal) maxTotal = res.total;
      (res.list || []).forEach((item: any) => {
        rawList.push({
          ...item,
          _sourceKey: res.site.key,
          _sourceName: res.site.name,
        });
      });
    });

    // 聚合去重与过滤逻辑
    const aggMap = new Map<string, any>();

    for (const item of rawList) {
      const typeName = item.type_name || '';
      const vodArea = item.vod_area || '';

      // 1. 过滤敏感词
      if (yellowWords.some((w: string) => typeName.includes(w))) continue;

      // 2. 类型筛选 (支持预设类别、具体原生标签、以及「其他」——包括空白未填)
      if (genreKey) {
        if (genreKey.startsWith('__other__:')) {
          const excludeList = genreKey.replace('__other__:', '').split(',');
          // 空白未填视为「其他」；若有值且属于前排排除项，则排除
          if (typeName && excludeList.some((ex) => typeName.includes(ex))) {
            continue;
          }
        } else if (GENRE_MAP[genreKey]) {
          const allowedWords = GENRE_MAP[genreKey];
          const matched = allowedWords.some((w) => typeName.includes(w));
          if (!matched) continue;
        } else {
          // 精确匹配采集站原生标签 (例如: '电影解说', 'AI漫剧', '国产动漫' 等)
          if (!typeName.includes(genreKey)) continue;
        }
      }

      // 3. 地区筛选 (支持预设大区代码、具体原生标签、以及「其他」——包括空白未填)
      if (areaKey) {
        if (areaKey.startsWith('__other__:')) {
          const excludeList = areaKey.replace('__other__:', '').split(',');
          // 空白未填视为「其他」；若有值且属于前排排除项，则排除
          if (vodArea && excludeList.some((ex) => vodArea.includes(ex))) {
            continue;
          }
        } else if (AREA_MAP[areaKey]) {
          const allowedAreas = AREA_MAP[areaKey];
          const matchedArea = allowedAreas.some(
            (a) => vodArea.includes(a) || typeName.includes(a)
          );
          if (!matchedArea) continue;
        } else {
          // 精确匹配采集站原生标签 (例如: '美国', '中国大陆', '日本' 等)
          if (!vodArea.includes(areaKey)) continue;
        }
      }

      // 4. 年份范围筛选 (支持具体年份、区间、以及「其他」——包括空白未填或0)
      const rawYearStr = item.vod_year || '';
      const numYear = parseInt(rawYearStr.match(/\d{4}/)?.[0] || '0', 10);
      if (year) {
        if (year.startsWith('__other__:')) {
          const excludeList = year.replace('__other__:', '').split(',');
          // 空白未填或0视为「其他」；若有年份且属于前排名单，则排除
          if (
            numYear > 0 &&
            excludeList.some((ex) => rawYearStr.includes(ex))
          ) {
            continue;
          }
        } else if (year === 'earlier') {
          // 2020 年之前
          if (!numYear || numYear >= 2020) continue;
        } else if (year.includes('-')) {
          const [startYear, endYear] = year
            .split('-')
            .map((v) => parseInt(v, 10));
          if (!numYear || numYear < startYear || numYear > endYear) continue;
        } else {
          // 单一指定年份
          if (!rawYearStr.includes(year)) continue;
        }
      }

      const cleanTitle = (item.vod_name || '').trim().replace(/\s+/g, ' ');
      const cleanYear = item.vod_year
        ? item.vod_year.match(/\d{4}/)?.[0] || item.vod_year
        : 'unknown';
      const dedupeKey = `${cleanTitle
        .toLowerCase()
        .replaceAll(' ', '')}-${cleanYear}`;

      if (!aggMap.has(dedupeKey)) {
        aggMap.set(dedupeKey, {
          id: String(item.vod_id),
          title: cleanTitle,
          poster: item.vod_pic || '',
          year: cleanYear,
          type_name: typeName,
          area: vodArea,
          source: item._sourceKey,
          source_name: item._sourceName,
          remarks: item.vod_remarks || '',
          desc: cleanHtmlTags(item.vod_content || ''),
          sources: [item._sourceName],
        });
      } else {
        const existing = aggMap.get(dedupeKey);
        if (!existing.sources.includes(item._sourceName)) {
          existing.sources.push(item._sourceName);
        }
        if (!existing.poster && item.vod_pic) {
          existing.poster = item.vod_pic;
        }
      }
    }

    const yearNum = (y: string) => parseInt(y, 10) || 0;
    const aggregatedList = Array.from(aggMap.values())
      .sort((a, b) => yearNum(b.year) - yearNum(a.year))
      .slice(0, TARGET_ITEMS_PER_BATCH);

    const result = {
      code: 200,
      batch,
      batchSize: aggregatedList.length,
      hasMore: aggregatedList.length >= 20,
      total: maxTotal,
      list: aggregatedList,
    };

    // 空结果（上游超时/失败）不缓存，避免筛选长期显示「暂无片源」
    if (aggregatedList.length === 0) {
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const cacheTime = await getCacheTime();
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
