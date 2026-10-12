/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { yellowWords } from '@/lib/yellow';

import { useDisplayMode } from '@/components/DisplayModeContext';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 获取默认聚合设置：只读取用户本地设置，默认为 true
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 默认启用聚合
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 读取已保存的过滤器设置或历史偏好
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('search_cached_year') || 'all';
    }
    return 'all';
  });
  const [selectedArea, setSelectedArea] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('search_cached_area') || 'all';
    }
    return 'all';
  });
  const [selectedType, setSelectedType] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('search_cached_type') || 'all';
    }
    return 'all';
  });

  // 记录用户在历史搜尋中曾選擇/用過的動態類型標籤（最多記錄 15 個）
  const [cachedCustomTypes, setCachedCustomTypes] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('search_custom_tags_cache');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleSelectYear = (yr: string) => {
    setSelectedYear(yr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('search_cached_year', yr);
    }
  };

  const handleSelectArea = (ar: string) => {
    setSelectedArea(ar);
    if (typeof window !== 'undefined') {
      localStorage.setItem('search_cached_area', ar);
    }
  };

  const handleSelectType = (tp: string) => {
    setSelectedType(tp);
    if (typeof window !== 'undefined') {
      localStorage.setItem('search_cached_type', tp);
      if (tp.startsWith('raw:')) {
        const tag = tp.replace('raw:', '');
        const updated = Array.from(new Set([tag, ...cachedCustomTypes])).slice(
          0,
          15
        );
        setCachedCustomTypes(updated);
        localStorage.setItem(
          'search_custom_tags_cache',
          JSON.stringify(updated)
        );
      }
    }
  };

  // 区域关键词映射（支持简繁及别名）
  const AREA_SEARCH_MAP: Record<string, string[]> = {
    cn: [
      '大陆',
      '大陸',
      '内地',
      '內地',
      '中国大陆',
      '中國大陸',
      '国产',
      '國產',
    ],
    hk: ['香港', '中国香港', '中國香港', '港剧', '港劇', '港片', 'TVB'],
    tw: ['台湾', '台灣', '中国台湾', '中國台灣', '台剧', '台劇'],
    jp: ['日本', '日漫', '日剧', '日劇', '日本动漫', '日本動漫'],
    kr: ['韩国', '韓國', '韩剧', '韓劇', '韩国剧', '韓國劇'],
    us: ['美国', '美國', '美剧', '美劇', '欧美', '歐美', '欧美剧', '歐美劇'],
    uk: ['英国', '英國', '英剧', '英劇'],
    th: ['泰国', '泰國', '泰剧', '泰劇'],
  };

  // 类型关键词映射
  const TYPE_SEARCH_MAP: Record<string, string[]> = {
    movie: [
      '电影',
      '電影',
      '动作',
      '喜劇',
      '喜剧',
      '爱情',
      '愛情',
      '科幻',
      '恐怖',
      '剧情',
      '劇情',
      '战争',
      '戰爭',
      '纪录',
      '紀錄',
    ],
    tv: ['剧', '劇', '电视剧', '電視劇', '连续剧', '連續劇'],
    anime: ['动漫', '動漫', '动画', '動畫'],
    show: ['综艺', '綜藝', '真人秀'],
    duanju: ['短剧', '短劇', '爽文', '总裁', '總裁'],
  };

  // 区分短剧关键词（防止短剧因集数或题材被误判为电影/电视剧）
  const DUANJU_KEYWORDS = [
    '短剧',
    '短劇',
    '爽文',
    '反转',
    '反轉',
    '总裁',
    '總裁',
    '现代都市',
    '現代都市',
    '现代言情',
    '現代言情',
    '都市脑洞',
    '都市腦洞',
    'AI漫剧',
    'AI漫劇',
    '漫剧',
    '漫劇',
    '战神',
    '戰神',
    '女恋',
    '女戀',
    '甜宠',
    '甜寵',
    '古装仙侠',
    '古裝仙俠',
  ];

  // 预设核心大类
  const DEFAULT_TYPES = [
    { label: '電影', value: 'movie' },
    { label: '劇集', value: 'tv' },
    { label: '動漫', value: 'anime' },
    { label: '綜藝', value: 'show' },
    { label: '短劇', value: 'duanju' },
  ];

  // 动态计算在当前搜索结果中出现的类型列表
  const availableTypes = useMemo(() => {
    if (!searchResults.length)
      return [{ label: '全部類型', value: 'all' }, ...DEFAULT_TYPES];

    // 统计各原生分类出现的次数
    const rawTagCount = new Map<string, number>();
    let hasMovie = false;
    let hasTv = false;
    let hasAnime = false;
    let hasShow = false;
    let hasDuanju = false;

    searchResults.forEach((item) => {
      const typeStr = (item.type_name || item.type || '').trim();
      const epLen = item.episodes?.length || 0;
      const isDuanju =
        DUANJU_KEYWORDS.some((w) => typeStr.includes(w)) ||
        item.title.includes('短剧') ||
        item.title.includes('爽文') ||
        epLen > 30;

      if (isDuanju) {
        hasDuanju = true;
      } else if (
        TYPE_SEARCH_MAP.anime.some((w) => typeStr.includes(w)) ||
        typeStr.includes('漫')
      ) {
        hasAnime = true;
      } else if (TYPE_SEARCH_MAP.show.some((w) => typeStr.includes(w))) {
        hasShow = true;
      } else if (
        TYPE_SEARCH_MAP.movie.some((w) => typeStr.includes(w)) ||
        (epLen === 1 && !typeStr.includes('剧') && !typeStr.includes('劇'))
      ) {
        hasMovie = true;
      } else if (
        TYPE_SEARCH_MAP.tv.some((w) => typeStr.includes(w)) ||
        epLen > 1
      ) {
        hasTv = true;
      }

      // 如果有具体的原生标签（例如：'现代都市'、'爽文短剧'、'动作片'、'科幻'、'古装仙侠'），且不是过于宽泛的
      if (typeStr && !['movie', 'tv', 'show'].includes(typeStr.toLowerCase())) {
        rawTagCount.set(typeStr, (rawTagCount.get(typeStr) || 0) + 1);
      }
    });

    const options: { label: string; value: string }[] = [
      { label: '全部類型', value: 'all' },
    ];

    // 添加有结果的标准大类
    if (hasMovie) options.push({ label: '電影', value: 'movie' });
    if (hasTv) options.push({ label: '劇集', value: 'tv' });
    if (hasAnime) options.push({ label: '動漫', value: 'anime' });
    if (hasShow) options.push({ label: '綜藝', value: 'show' });
    if (hasDuanju) options.push({ label: '短劇', value: 'duanju' });

    // 动态添加搜索结果中出现频次较高的原生具体细分标签（排除已完全同名的大类）
    const sortedRawTags = Array.from(rawTagCount.entries())
      .filter(
        ([tag]) => !['电影', '电视剧', '动漫', '综艺', '短剧'].includes(tag)
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // 最多追加 8 个最匹配的高频子类型（如：现代都市、AI漫剧、爽文短剧、动作片）

    sortedRawTags.forEach(([tag]) => {
      // 避免重复
      if (!options.some((o) => o.label === tag)) {
        options.push({ label: tag, value: `raw:${tag}` });
      }
    });

    // 融入从 browser cache 记录的常用/历史 dynamic filter
    cachedCustomTypes.forEach((cachedTag) => {
      if (
        !options.some(
          (o) => o.label === cachedTag || o.value === `raw:${cachedTag}`
        )
      ) {
        options.push({ label: cachedTag, value: `raw:${cachedTag}` });
      }
    });

    // 如果当前选中的类型既不是 all 也还没在 options 列表中，将其补齐加入
    if (selectedType && selectedType !== 'all') {
      const isExist = options.some((o) => o.value === selectedType);
      if (!isExist) {
        const lbl = selectedType.startsWith('raw:')
          ? selectedType.replace('raw:', '')
          : selectedType;
        options.push({ label: lbl, value: selectedType });
      }
    }

    return options;
  }, [searchResults, cachedCustomTypes, selectedType]);

  // 动态计算在当前搜索结果中出现的地区列表
  const availableAreas = useMemo(() => {
    if (!searchResults.length) {
      return [
        { label: '全部地區', value: 'all' },
        { label: '中國大陸', value: 'cn' },
        { label: '中國香港', value: 'hk' },
        { label: '中國台灣', value: 'tw' },
        { label: '美國', value: 'us' },
        { label: '日本', value: 'jp' },
        { label: '韓國', value: 'kr' },
      ];
    }

    const matchedAreas = new Set<string>();
    searchResults.forEach((item) => {
      const itemArea = item.area || '';
      const itemType = item.type_name || item.type || '';
      Object.entries(AREA_SEARCH_MAP).forEach(([key, words]) => {
        if (words.some((w) => itemArea.includes(w) || itemType.includes(w))) {
          matchedAreas.add(key);
        }
      });
    });

    const standardOrder = [
      { label: '中國大陸', value: 'cn' },
      { label: '中國香港', value: 'hk' },
      { label: '中國台灣', value: 'tw' },
      { label: '美國', value: 'us' },
      { label: '日本', value: 'jp' },
      { label: '韓國', value: 'kr' },
      { label: '英國', value: 'uk' },
      { label: '泰國', value: 'th' },
    ];

    const options = [{ label: '全部地區', value: 'all' }];
    standardOrder.forEach((item) => {
      if (matchedAreas.has(item.value)) {
        options.push(item);
      }
    });

    // 检查是否有其他地区
    const allMainWords = Object.values(AREA_SEARCH_MAP).flat();
    const hasOther = searchResults.some((item) => {
      const a = item.area || '';
      return a && !allMainWords.some((w) => a.includes(w));
    });
    if (hasOther) {
      options.push({ label: '其他', value: 'other' });
    }

    return options;
  }, [searchResults]);

  // 多条件过滤后的搜索结果
  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((item) => {
      // 1. 年份筛选
      if (selectedYear !== 'all') {
        const yr = parseInt(item.year, 10);
        if (selectedYear === '2026_plus' && (isNaN(yr) || yr < 2026))
          return false;
        if (selectedYear === '2025' && item.year !== '2025') return false;
        if (selectedYear === '2024' && item.year !== '2024') return false;
        if (selectedYear === '2023' && item.year !== '2023') return false;
        if (
          selectedYear === '2020-2022' &&
          (isNaN(yr) || yr < 2020 || yr > 2022)
        )
          return false;
        if (selectedYear === 'earlier' && (isNaN(yr) || yr >= 2020))
          return false;
      }

      // 2. 地区筛选
      if (selectedArea !== 'all') {
        const itemArea = item.area || '';
        const itemType = item.type_name || item.type || '';
        if (selectedArea === 'other') {
          const mainAreaWords = Object.values(AREA_SEARCH_MAP).flat();
          const matchesMain = mainAreaWords.some(
            (w) => itemArea.includes(w) || itemType.includes(w)
          );
          if (matchesMain) return false;
        } else {
          const targets = AREA_SEARCH_MAP[selectedArea] || [];
          const matches = targets.some(
            (w) => itemArea.includes(w) || itemType.includes(w)
          );
          if (!matches) return false;
        }
      }

      // 3. 类别/题材筛选
      if (selectedType !== 'all') {
        const itemType = (item.type_name || item.type || '').trim();
        const epLen = item.episodes?.length || 0;

        // 如果用户选择了具体的动态细分标签（例如 raw:现代都市、raw:AI漫剧、raw:爽文短剧）
        if (selectedType.startsWith('raw:')) {
          const targetTag = selectedType.replace('raw:', '');
          if (
            !itemType.includes(targetTag) &&
            !item.title.includes(targetTag)
          ) {
            return false;
          }
          return true;
        }

        const isDuanju =
          DUANJU_KEYWORDS.some((w) => itemType.includes(w)) ||
          item.title.includes('短剧') ||
          item.title.includes('爽文') ||
          epLen > 30; // 短剧通常是几十集甚至近百集

        if (selectedType === 'duanju') {
          if (!isDuanju) return false;
        } else if (selectedType === 'anime') {
          const isAnime =
            TYPE_SEARCH_MAP.anime.some((w) => itemType.includes(w)) ||
            itemType.includes('漫');
          if (!isAnime || isDuanju) return false;
        } else if (selectedType === 'show') {
          const isShow = TYPE_SEARCH_MAP.show.some((w) => itemType.includes(w));
          if (!isShow) return false;
        } else if (selectedType === 'movie') {
          // 是电影：不能是短剧、综艺、动漫，且 (包含电影/动作片等词 或 单集且不是剧)
          if (isDuanju) return false;
          const isAnime = TYPE_SEARCH_MAP.anime.some((w) =>
            itemType.includes(w)
          );
          const isShow = TYPE_SEARCH_MAP.show.some((w) => itemType.includes(w));
          if (isAnime || isShow) return false;

          const hasMovieWord = TYPE_SEARCH_MAP.movie.some((w) =>
            itemType.includes(w)
          );
          const isSingleEp =
            epLen === 1 && !itemType.includes('剧') && !itemType.includes('劇');
          if (!hasMovieWord && !isSingleEp) return false;
        } else if (selectedType === 'tv') {
          // 是电视剧：不能是短剧、综艺、动漫，且 (包含电视剧关键词 或 多集剧集)
          if (isDuanju) return false;
          const isAnime = TYPE_SEARCH_MAP.anime.some((w) =>
            itemType.includes(w)
          );
          const isShow = TYPE_SEARCH_MAP.show.some((w) => itemType.includes(w));
          if (isAnime || isShow) return false;

          const hasTvWord = TYPE_SEARCH_MAP.tv.some((w) =>
            itemType.includes(w)
          );
          const isMultiEp = epLen > 1;
          if (!hasTvWord && !isMultiEp) return false;
        }
      }

      return true;
    });
  }, [searchResults, selectedYear, selectedArea, selectedType]);

  // 聚合后的结果（按标题和年份分组）
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    filteredSearchResults.forEach((item) => {
      // 使用 title + year + type 作为键，year 必然存在，但依然兜底 'unknown'
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 优先排序：标题与搜索词完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        // 处理 unknown 的情况
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1; // a 排在后面
        } else if (bYear === 'unknown') {
          return -1; // b 排在后面
        } else {
          // 都是数字年份，按数字大小排序（大的在前面）
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  }, [filteredSearchResults, searchQuery]);

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    // 获取滚动位置的函数 - 专门针对 body 滚动
    const getScrollTop = () => {
      return document.body.scrollTop || 0;
    };

    // 使用 requestAnimationFrame 持续检测滚动位置
    let isRunning = false;
    const checkScrollPosition = () => {
      if (!isRunning) return;

      const scrollTop = getScrollTop();
      const shouldShow = scrollTop > 300;
      setShowBackToTop(shouldShow);

      requestAnimationFrame(checkScrollPosition);
    };

    // 启动持续检测
    isRunning = true;
    checkScrollPosition();

    // 监听 body 元素的滚动事件
    const handleScroll = () => {
      const scrollTop = getScrollTop();
      setShowBackToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      unsubscribe();
      isRunning = false; // 停止 requestAnimationFrame 循环

      // 移除 body 滚动事件监听器
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  const fetchSearchResults = async (query: string) => {
    try {
      setIsLoading(true);
      // 从 browser cache 中恢复用户之前设定的 default 筛选偏好
      if (typeof window !== 'undefined') {
        const savedYear = localStorage.getItem('search_cached_year');
        if (savedYear) setSelectedYear(savedYear);
        const savedArea = localStorage.getItem('search_cached_area');
        if (savedArea) setSelectedArea(savedArea);
        const savedType = localStorage.getItem('search_cached_type');
        if (savedType) setSelectedType(savedType);
      }
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = await response.json();
      let results = data.results;
      if (
        typeof window !== 'undefined' &&
        !(window as any).RUNTIME_CONFIG?.DISABLE_YELLOW_FILTER
      ) {
        results = results.filter((result: SearchResult) => {
          const typeName = result.type_name || '';
          return !yellowWords.some((word: string) => typeName.includes(word));
        });
      }
      setSearchResults(
        results.sort((a: SearchResult, b: SearchResult) => {
          // 优先排序：标题与搜索词完全一致的排在前面
          const aExactMatch = a.title === query.trim();
          const bExactMatch = b.title === query.trim();

          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          // 如果都匹配或都不匹配，则按原来的逻辑排序
          if (a.year === b.year) {
            return a.title.localeCompare(b.title);
          } else {
            // 处理 unknown 的情况
            if (a.year === 'unknown' && b.year === 'unknown') {
              return 0;
            } else if (a.year === 'unknown') {
              return 1; // a 排在后面
            } else if (b.year === 'unknown') {
              return -1; // b 排在后面
            } else {
              // 都是数字年份，按数字大小排序（大的在前面）
              return parseInt(a.year) > parseInt(b.year) ? -1 : 1;
            }
          }
        })
      );
      setShowResults(true);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回显搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    // 直接发请求
    fetchSearchResults(trimmed);

    // 保存到搜索历史 (事件监听会自动更新界面)
    addSearchHistory(trimmed);
  };

  // 返回顶部功能
  const scrollToTop = () => {
    try {
      // 根据调试结果，真正的滚动容器是 document.body
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      // 如果平滑滚动完全失败，使用立即滚动
      document.body.scrollTop = 0;
    }
  };

  const { mode, gridClass } = useDisplayMode();

  return (
    <PageLayout activePath='/search'>
      <div
        className={`px-2 sm:px-6 py-2 sm:py-4 overflow-visible mb-6 ${
          mode === 'tv' ? 'max-w-none' : ''
        }`}
      >
        {/* 搜索框：靠左排列，宽度限制約 15 字元（避免與右上方圖示重疊） */}
        <div className='mb-3 flex justify-start'>
          <form onSubmit={handleSearch} className='w-full max-w-[240px]'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='搜尋影片片名...'
                className='w-full h-8 rounded-lg bg-gray-50/80 py-1 pl-8 pr-3 text-xs sm:text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='w-full mx-auto mt-3 overflow-visible'>
          {isLoading ? (
            <div className='flex justify-center items-center h-28'>
              <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
            </div>
          ) : showResults ? (
            <section className='mb-6'>
              {/* 标题 + 聚合开关 */}
              <div className='mb-3 flex items-center justify-between gap-2 flex-wrap'>
                <h2 className='text-base sm:text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜尋結果
                </h2>
                {/* 聚合开关 */}
                <label className='flex items-center gap-2 cursor-pointer select-none shrink-0'>
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>

              {/* 筛选选项组（年份、地區、類型） */}
              <div className='mb-4 space-y-2.5 bg-gray-50/50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800'>
                {/* 1. 年份筛选 */}
                <div className='flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5'>
                  <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0 w-9'>
                    年份:
                  </span>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    {[
                      { label: '全部年份', value: 'all' },
                      { label: '2026及之後', value: '2026_plus' },
                      { label: '2025', value: '2025' },
                      { label: '2024', value: '2024' },
                      { label: '2023', value: '2023' },
                      { label: '2020-2022', value: '2020-2022' },
                      { label: '更早', value: 'earlier' },
                    ].map((btn) => (
                      <button
                        key={btn.value}
                        type='button'
                        onClick={() => handleSelectYear(btn.value)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 font-medium shrink-0 ${
                          selectedYear === btn.value
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. 地區筛选 */}
                {availableAreas.length > 1 && (
                  <div className='flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5'>
                    <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0 w-9'>
                      地區:
                    </span>
                    <div className='flex items-center gap-1.5 shrink-0'>
                      {availableAreas.map((btn) => (
                        <button
                          key={btn.value}
                          type='button'
                          onClick={() => handleSelectArea(btn.value)}
                          className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 font-medium shrink-0 ${
                            selectedArea === btn.value
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. 類型筛选 */}
                {availableTypes.length > 1 && (
                  <div className='flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5'>
                    <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0 w-9'>
                      類型:
                    </span>
                    <div className='flex items-center gap-1.5 shrink-0'>
                      {availableTypes.map((btn) => (
                        <button
                          key={btn.value}
                          type='button'
                          onClick={() => handleSelectType(btn.value)}
                          className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 font-medium shrink-0 ${
                            selectedType === btn.value
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                key={`search-results-${viewMode}-${selectedYear}-${selectedArea}-${selectedType}`}
                className={`justify-start ${gridClass}`}
              >
                {viewMode === 'agg'
                  ? aggregatedResults.map(([mapKey, group]) => {
                      return (
                        <div key={`agg-${mapKey}`} className='w-full'>
                          <VideoCard
                            from='search'
                            items={group}
                            query={
                              searchQuery.trim() !== group[0].title
                                ? searchQuery.trim()
                                : ''
                            }
                          />
                        </div>
                      );
                    })
                  : filteredSearchResults.map((item) => (
                      <div
                        key={`all-${item.source}-${item.id}`}
                        className='w-full'
                      >
                        <VideoCard
                          id={item.id}
                          title={item.title}
                          poster={item.poster}
                          episodes={item.episodes.length}
                          source={item.source}
                          source_name={item.source_name}
                          douban_id={item.douban_id?.toString()}
                          query={
                            searchQuery.trim() !== item.title
                              ? searchQuery.trim()
                              : ''
                          }
                          year={item.year}
                          area={item.area}
                          from='search'
                          type={
                            item.type_name ||
                            item.type ||
                            (item.episodes.length > 1 ? '劇集' : '電影')
                          }
                        />
                      </div>
                    ))}
                {searchResults.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相關結果
                  </div>
                )}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索历史
            <section className='mb-6'>
              <h2 className='mb-3 text-base sm:text-lg font-bold text-gray-800 text-left dark:text-gray-200 flex items-center justify-between'>
                <span>搜尋歷史</span>
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory(); // 事件监听会自动更新界面
                    }}
                    className='text-xs font-normal text-gray-400 hover:text-red-500 transition-colors dark:text-gray-500 dark:hover:text-red-400'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-1.5'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(
                          `/search?q=${encodeURIComponent(item.trim())}`
                        );
                      }}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      aria-label='刪除搜尋歷史'
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item); // 事件监听会自动更新界面
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
