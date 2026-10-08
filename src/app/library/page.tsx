/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, no-console */
'use client';

import { BarChart3 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import DoubanCardSkeleton from '@/components/DbCardSkeleton';
import { useDisplayMode } from '@/components/DisplayModeContext';
import LibraryStatsModal from '@/components/LibraryStatsModal';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface VodItem {
  id: string;
  title: string;
  poster: string;
  year: string;
  type_name: string;
  area?: string;
  source: string;
  source_name: string;
  remarks: string;
  desc: string;
  sources?: string[];
}

import libraryOptionsData from '@/lib/libraryOptions.json';

interface FilterOption {
  label: string;
  value: string;
}

const DEFAULT_OPTIONS: {
  areas: FilterOption[];
  types: FilterOption[];
  years: FilterOption[];
} = {
  areas: [
    { label: '全部地區', value: '' },
    { label: '中国大陆', value: '中国大陆' },
    { label: '大陆', value: '大陆' },
    { label: '日本', value: '日本' },
    { label: '美国', value: '美国' },
    { label: '内地', value: '内地' },
    { label: '韩国', value: '韩国' },
    { label: '英国', value: '英国' },
    { label: '泰国', value: '泰国' },
    { label: '台湾', value: '台湾' },
    {
      label: '其他',
      value: '__other__:中国大陆,大陆,日本,美国,内地,韩国,英国,泰国,台湾',
    },
  ],
  types: [
    { label: '全部類型', value: '' },
    { label: 'AI漫剧', value: 'AI漫剧' },
    { label: '爽文短剧', value: '爽文短剧' },
    { label: '国产动漫', value: '国产动漫' },
    { label: '国产剧', value: '国产剧' },
    { label: '漫剧', value: '漫剧' },
    { label: 'AI短剧', value: 'AI短剧' },
    { label: '足球', value: '足球' },
    { label: '短剧', value: '短剧' },
    { label: '现代都市', value: '现代都市' },
    {
      label: '其他',
      value:
        '__other__:AI漫剧,爽文短剧,国产动漫,国产剧,漫剧,AI短剧,足球,短剧,现代都市',
    },
  ],
  years: [
    { label: '全部年份', value: '' },
    { label: '2026', value: '2026' },
    { label: '2025', value: '2025' },
    { label: '2024', value: '2024' },
    { label: '2023', value: '2023' },
    { label: '2022', value: '2022' },
    { label: '2021', value: '2021' },
    { label: '2020', value: '2020' },
    { label: '2019', value: '2019' },
    { label: '2018', value: '2018' },
    {
      label: '其他',
      value: '__other__:2026,2025,2024,2023,2022,2021,2020,2019,2018',
    },
  ],
};

function LibraryPageClient() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || '';
  const yearParam = searchParams.get('year') || '';
  const areaParam = searchParams.get('area') || '';

  // 默认全部年份 ('')，全部类型 ('')，全部地区 ('')
  const initialYear = yearParam || '';

  const [items, setItems] = useState<VodItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  // 子类型默认选中「全部類型」(即 '')
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>(areaParam);
  const [selectedDuanjuTheme, setSelectedDuanjuTheme] =
    useState<string>('duanju');
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const isDuanjuMode =
    typeParam === 'duanju' ||
    selectedCategory === 'duanju' ||
    selectedCategory.startsWith('duanju_');

  // 当 URL searchParams 改变时（例如从側邊欄「短劇」跳到「動漫」或「電影」）重置为全部('')
  useEffect(() => {
    setSelectedCategory('');
    setSelectedYear(yearParam || '');
    setSelectedArea(areaParam);
    setSelectedDuanjuTheme('duanju');
  }, [typeParam, yearParam, areaParam]);

  // batch 代表第几批（每批 100 部）
  const [batch, setBatch] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 加载数据（每次请求自动跨节点聚合出 100 部去重影片）
  const fetchData = useCallback(
    async (targetBatch: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams();
        params.set('batch', String(targetBatch));
        params.set('v', '2');
        if (selectedYear) params.set('year', selectedYear);

        // 类型传递：
        // 1. 如果选中了具体的子类型(如'电影解说'或'__other__:')，传递 selectedCategory
        // 2. 如果是「全部類型」(selectedCategory 為空)，但 URL 有大板块(如 ?type=movie)，传递大板块 typeParam
        // 3. 如果是短剧模式，且有子题材，传递该题材
        if (isDuanjuMode && selectedCategory) {
          params.set('type', selectedCategory);
        } else if (selectedCategory) {
          params.set('type', selectedCategory);
        } else if (typeParam) {
          params.set('type', typeParam);
        }

        if (selectedArea) params.set('area', selectedArea);

        const res = await fetch(`/api/vod/list?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch library data');
        const data = await res.json();

        if (data.code === 200) {
          setTotalCount(data.total || 0);
          setHasMore(Boolean(data.hasMore));

          if (append) {
            setItems((prev) => [...prev, ...(data.list || [])]);
          } else {
            setItems(data.list || []);
          }
        }
      } catch (err) {
        console.error('Fetch library error:', err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      selectedYear,
      selectedCategory,
      selectedArea,
      selectedDuanjuTheme,
      isDuanjuMode,
    ]
  );

  // 筛选条件（年份/类型/地区/短剧题材）变化时，重置并获取第一批 100 部
  useEffect(() => {
    setBatch(1);
    fetchData(1, false);
  }, [selectedYear, selectedCategory, selectedArea, selectedDuanjuTheme]);

  // 无限滚动监听（滚动到底部时自动捞取下一批 100 部）
  useEffect(() => {
    if (loading || isLoadingMore || !hasMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !loading
        ) {
          const nextBatch = batch + 1;
          setBatch(nextBatch);
          fetchData(nextBatch, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, isLoadingMore, hasMore, batch, fetchData]);

  const { mode, gridClass } = useDisplayMode();
  const skeletonData = Array.from({ length: 24 }, (_, i) => i);

  const pageTitle =
    typeParam === 'duanju'
      ? '短劇熱門推薦'
      : typeParam === 'anime'
      ? '動漫精選推薦'
      : typeParam === 'movie'
      ? '電影精選直連'
      : typeParam === 'tv'
      ? '劇集精選直連'
      : typeParam === 'variety'
      ? '綜藝精選直連'
      : '片庫聚合直連';

  // 映射当前 4~9 的导航路径，获取对应的 10 项精准筛选配置
  const activePath = typeParam ? `/library?type=${typeParam}` : '/library';
  const currentFilters =
    (
      libraryOptionsData as Record<
        string,
        {
          areas: FilterOption[];
          types: FilterOption[];
          years: FilterOption[];
        }
      >
    )[activePath] || DEFAULT_OPTIONS;

  return (
    <PageLayout activePath={activePath}>
      <div
        className={`px-2 sm:px-6 py-2 sm:py-4 mx-auto ${
          mode === 'tv' ? 'max-w-none' : 'max-w-7xl'
        }`}
      >
        {/* 顶部标题与数量徽章（放在左侧标题右边，避免与右上角全局圖標重疊） */}
        <div className='mb-2 flex items-center justify-start gap-2.5 flex-wrap'>
          <h1 className='text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100'>
            {pageTitle}
          </h1>
          {totalCount > 0 && (
            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-normal bg-gray-100 text-gray-500 border border-gray-200/60 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700/60'>
              已載入 {items.length} / 逾 {totalCount.toLocaleString()} 部
            </span>
          )}
          <button
            type='button'
            onClick={() => setIsStatsOpen(true)}
            title='片庫真實數據統計 (10,000部)'
            aria-label='片庫真實數據統計 (10,000部)'
            className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 transition-all shadow-sm hover:scale-105 active:scale-95'
          >
            <BarChart3 className='w-4 h-4 text-emerald-600 dark:text-emerald-400' />
          </button>
        </div>

        {/* 筛选面板：
            - 普通模式：横向滚动条
            - 电视模式 (mode === 'tv')：共 12 个资料（全部 + 10个具体选项 + 其他），每个类别拆成 2 行显示，每行 6 个按钮，类型+地区+年份共 6 行，极其方便遥控器直观操控 */}
        <div className='bg-white/60 dark:bg-gray-800/40 rounded-xl p-2 sm:p-2.5 border border-gray-200/30 dark:border-gray-700/30 space-y-2 backdrop-blur-sm'>
          {/* 1. 片種 / 類型篩選 */}
          {currentFilters.types && currentFilters.types.length > 1 && (
            <div className='space-y-1.5'>
              {mode === 'tv' ? (
                // 电视模式：拆成 2 行，每行 6 个
                [0, 1].map((rowIdx) => {
                  const rowItems = currentFilters.types.slice(
                    rowIdx * 6,
                    (rowIdx + 1) * 6
                  );
                  if (rowItems.length === 0) return null;
                  return (
                    <div
                      key={`type-row-${rowIdx}`}
                      className='flex items-center gap-2'
                    >
                      <span className='text-[12px] text-gray-400 dark:text-gray-500 font-semibold w-12 shrink-0'>
                        {rowIdx === 0 ? '類型:' : ''}
                      </span>
                      <div className='grid grid-cols-6 gap-2 flex-1'>
                        {rowItems.map((tab) => {
                          const active = selectedCategory === tab.value;
                          return (
                            <button
                              key={tab.value || 'all-type'}
                              type='button'
                              onClick={() => setSelectedCategory(tab.value)}
                              className={`text-xs py-1.5 px-2 rounded-lg transition-all font-medium text-center truncate ${
                                active
                                  ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                // 普通桌面 / 移动端：单行横向滚动
                <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5'>
                  <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0'>
                    類型:
                  </span>
                  {currentFilters.types.map((tab) => {
                    const active = selectedCategory === tab.value;
                    return (
                      <button
                        key={tab.value || 'all-type'}
                        type='button'
                        onClick={() => setSelectedCategory(tab.value)}
                        className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                          active
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. 國家 / 地區篩選 */}
          {currentFilters.areas && currentFilters.areas.length > 1 && (
            <div className='space-y-1.5'>
              {mode === 'tv' ? (
                // 电视模式：拆成 2 行，每行 6 个
                [0, 1].map((rowIdx) => {
                  const rowItems = currentFilters.areas.slice(
                    rowIdx * 6,
                    (rowIdx + 1) * 6
                  );
                  if (rowItems.length === 0) return null;
                  return (
                    <div
                      key={`area-row-${rowIdx}`}
                      className='flex items-center gap-2'
                    >
                      <span className='text-[12px] text-gray-400 dark:text-gray-500 font-semibold w-12 shrink-0'>
                        {rowIdx === 0 ? '地區:' : ''}
                      </span>
                      <div className='grid grid-cols-6 gap-2 flex-1'>
                        {rowItems.map((a) => {
                          const active = selectedArea === a.value;
                          return (
                            <button
                              key={a.value || 'all-area'}
                              type='button'
                              onClick={() => setSelectedArea(a.value)}
                              className={`text-xs py-1.5 px-2 rounded-lg transition-all font-medium text-center truncate ${
                                active
                                  ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                // 普通桌面 / 移动端：单行横向滚动
                <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5'>
                  <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0'>
                    地區:
                  </span>
                  {currentFilters.areas.map((a) => {
                    const active = selectedArea === a.value;
                    return (
                      <button
                        key={a.value || 'all-area'}
                        type='button'
                        onClick={() => setSelectedArea(a.value)}
                        className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                          active
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. 上映年份 / 時間篩選 */}
          {currentFilters.years && currentFilters.years.length > 1 && (
            <div className='space-y-1.5'>
              {mode === 'tv' ? (
                // 电视模式：拆成 2 行，每行 6 个
                [0, 1].map((rowIdx) => {
                  const rowItems = currentFilters.years.slice(
                    rowIdx * 6,
                    (rowIdx + 1) * 6
                  );
                  if (rowItems.length === 0) return null;
                  return (
                    <div
                      key={`year-row-${rowIdx}`}
                      className='flex items-center gap-2'
                    >
                      <span className='text-[12px] text-gray-400 dark:text-gray-500 font-semibold w-12 shrink-0'>
                        {rowIdx === 0 ? '時間:' : ''}
                      </span>
                      <div className='grid grid-cols-6 gap-2 flex-1'>
                        {rowItems.map((y) => {
                          const active = selectedYear === y.value;
                          return (
                            <button
                              key={y.value || 'all-year'}
                              type='button'
                              onClick={() => setSelectedYear(y.value)}
                              className={`text-xs py-1.5 px-2 rounded-lg transition-all font-medium text-center truncate ${
                                active
                                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {y.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                // 普通桌面 / 移动端：单行横向滚动
                <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5'>
                  <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0'>
                    年份:
                  </span>
                  {currentFilters.years.map((y) => {
                    const active = selectedYear === y.value;
                    return (
                      <button
                        key={y.value || 'all-year'}
                        type='button'
                        onClick={() => setSelectedYear(y.value)}
                        className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {y.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 资源列表展示 */}
        <div className='mt-8'>
          <div className={`justify-start ${gridClass}`}>
            {loading
              ? skeletonData.map((i) => <DoubanCardSkeleton key={i} />)
              : items.map((item, idx) => (
                  <div
                    key={`${item.source}-${item.id}-${idx}`}
                    className='w-full'
                  >
                    <VideoCard
                      from='search'
                      id={item.id}
                      title={item.title}
                      query={item.title}
                      poster={item.poster}
                      source={item.source}
                      year={item.year}
                      type={item.type_name}
                      area={item.area}
                    />
                  </div>
                ))}
          </div>

          {/* 无限滚动触发：到底部自动拉取另外 100 部 */}
          {hasMore && !loading && (
            <div
              ref={loadingRef}
              className='flex flex-col items-center justify-center mt-12 py-8 gap-2'
            >
              {isLoadingMore ? (
                <div className='flex items-center gap-2'>
                  <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
                  <span className='text-gray-600 dark:text-gray-400 text-sm'>
                    正在載入下一批 100 部影片... (目前已載入 {items.length} 部)
                  </span>
                </div>
              ) : (
                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  向下捲動將自動載入更多片源（每次 100 部）
                </span>
              )}
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <div className='text-center text-gray-500 py-8 text-sm'>
              已載入全部符合篩選條件的片源
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className='text-center text-gray-500 py-16 text-sm'>
              暫無符合條件的片源
            </div>
          )}
        </div>
      </div>

      {/* 獨立數據統計分析彈窗 (支援 1,000 部真實資料抽取與點擊索取) */}
      <LibraryStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />
    </PageLayout>
  );
}

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryPageClient />
    </Suspense>
  );
}
