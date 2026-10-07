/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, no-console */
'use client';

import { Clapperboard, Film, Flame, Sparkles, Tv, Video } from 'lucide-react';
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

const CURRENT_YEAR = new Date().getFullYear(); // 动态获取最新年份

const YEAR_OPTIONS = [
  { label: '全部年份', value: '' },
  { label: `${CURRENT_YEAR}`, value: `${CURRENT_YEAR}` },
  { label: `${CURRENT_YEAR - 1}`, value: `${CURRENT_YEAR - 1}` },
  { label: `${CURRENT_YEAR - 2}`, value: `${CURRENT_YEAR - 2}` },
  { label: `${CURRENT_YEAR - 3}`, value: `${CURRENT_YEAR - 3}` },
  { label: `${CURRENT_YEAR - 4}`, value: `${CURRENT_YEAR - 4}` },
  { label: `${CURRENT_YEAR - 5}`, value: `${CURRENT_YEAR - 5}` },
  { label: `${CURRENT_YEAR - 6}`, value: `${CURRENT_YEAR - 6}` },
  { label: '2020年前', value: 'earlier' },
];

// 纯以「时间 + 真正片种类形」分类，不以节点分类
const CATEGORY_TABS = [
  { label: '全部類型', value: '', icon: Clapperboard },
  { label: '短劇', value: 'duanju', icon: Flame },
  { label: '動作片', value: 'action', icon: Film },
  { label: '喜劇片', value: 'comedy', icon: Sparkles },
  { label: '愛情片', value: 'romance', icon: Sparkles },
  { label: '科幻片', value: 'scifi', icon: Sparkles },
  { label: '懸疑 / 犯罪', value: 'suspense', icon: Film },
  { label: '武俠古裝', value: 'wuxia', icon: Film },
  { label: '驚悚 / 恐怖', value: 'horror', icon: Film },
  { label: '戰爭片', value: 'war', icon: Film },
  { label: '紀錄片', value: 'doc', icon: Video },
  { label: '電視劇', value: 'tv', icon: Tv },
  { label: '動漫', value: 'anime', icon: Sparkles },
  { label: '綜藝', value: 'variety', icon: Video },
];

// 短剧细分题材
const DUANJU_THEME_OPTIONS = [
  { label: '全部題材', value: 'duanju' },
  { label: '現代都市', value: 'duanju_modern' },
  { label: '言情總裁', value: 'duanju_ceo' },
  { label: '年代穿越', value: 'duanju_time' },
  { label: '重生民國', value: 'duanju_rebirth' },
  { label: 'AI漫劇', value: 'duanju_ai' },
  { label: '反轉逆襲', value: 'duanju_twist' },
];

// 地区分类：简化直接使用纯粹分类
const AREA_OPTIONS = [
  { label: '全部', value: '' },
  { label: '日本', value: 'jp' },
  { label: '大陆', value: 'cn' },
  { label: '台湾', value: 'tw' },
  { label: '美国', value: 'us' },
  { label: '海外', value: 'overseas' },
];

function LibraryPageClient() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || '';
  const yearParam = searchParams.get('year') || '';
  const areaParam = searchParams.get('area') || '';

  const [items, setItems] = useState<VodItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(yearParam);
  const [selectedCategory, setSelectedCategory] = useState<string>(typeParam);
  const [selectedArea, setSelectedArea] = useState<string>(areaParam);
  const [selectedDuanjuTheme, setSelectedDuanjuTheme] =
    useState<string>('duanju');

  const isDuanjuMode =
    selectedCategory === 'duanju' ||
    selectedCategory.startsWith('duanju_') ||
    typeParam === 'duanju';

  // 当 URL searchParams 改变时（例如从側邊欄「短劇」跳到「動漫」或「片庫直連」）同步更新狀態
  useEffect(() => {
    setSelectedCategory(typeParam);
    setSelectedYear(yearParam);
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
        if (selectedYear) params.set('year', selectedYear);

        // 如果在短剧模式下，根据选中的题材分类请求
        if (isDuanjuMode) {
          params.set('type', selectedDuanjuTheme || 'duanju');
        } else if (selectedCategory) {
          params.set('type', selectedCategory);
        }

        if (selectedArea && !isDuanjuMode) params.set('area', selectedArea);

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

  // 根据当前类型决定页面标题与是否锁定片种
  const pageTitle =
    typeParam === 'duanju'
      ? '短劇熱門推薦'
      : typeParam === 'anime'
      ? '動漫精選推薦'
      : '片庫聚合直連';

  // 当从 sidebar 点击「短剧」或「动漫」进入时，类型已固定，无需再显示类型条
  const isTypeLocked = Boolean(typeParam);

  const activePath = typeParam ? `/library?type=${typeParam}` : '/library';

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
        </div>

        {/* 筛选面板：緊湊無 Icon 壓縮排版 */}
        <div className='bg-white/60 dark:bg-gray-800/40 rounded-xl p-2 sm:p-2.5 border border-gray-200/30 dark:border-gray-700/30 space-y-1.5 backdrop-blur-sm'>
          {/* 1. 類型 / 片種（若在短劇或動漫專頁，則已內定類型，不需要再顯示此條 bar；明確劃分為兩行） */}
          {!isTypeLocked && (
            <div className='space-y-1.5'>
              {/* 第一行 */}
              <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide'>
                <span className='text-[11px] text-gray-400 dark:text-gray-500 font-medium shrink-0'>
                  類型:
                </span>
                {CATEGORY_TABS.slice(0, 7).map((tab) => {
                  const active = selectedCategory === tab.value;
                  return (
                    <button
                      key={tab.value}
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
              {/* 第二行 */}
              <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide pl-7 sm:pl-8'>
                {CATEGORY_TABS.slice(7).map((tab) => {
                  const active = selectedCategory === tab.value;
                  return (
                    <button
                      key={tab.value}
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
            </div>
          )}

          {/* 2. 時間年份（分為兩行：第一行個別近年年份，第二行年代區間） */}
          <div className='space-y-1.5'>
            {/* 年份第一行：全部年份 + 2026 ~ 2020 */}
            <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide'>
              <span className='text-[11px] text-gray-400 dark:text-gray-500 font-medium shrink-0'>
                年份:
              </span>
              {YEAR_OPTIONS.slice(0, 8).map((y) => (
                <button
                  key={y.value}
                  type='button'
                  onClick={() => setSelectedYear(y.value)}
                  className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                    selectedYear === y.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {y.label}
                </button>
              ))}
            </div>
            {/* 年份第二行：2019~2015、2015~2010 及更早 */}
            <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide pl-7 sm:pl-8'>
              {YEAR_OPTIONS.slice(8).map((y) => (
                <button
                  key={y.value}
                  type='button'
                  onClick={() => setSelectedYear(y.value)}
                  className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                    selectedYear === y.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 題材 / 地區篩選：若處於短劇模式，動態呈現短劇題材子分類；非短劇時呈現地區篩選 */}
          {isDuanjuMode ? (
            <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide'>
              <span className='text-[11px] text-gray-400 dark:text-gray-500 font-medium shrink-0'>
                題材:
              </span>
              {DUANJU_THEME_OPTIONS.map((theme) => {
                const active = selectedDuanjuTheme === theme.value;
                return (
                  <button
                    key={theme.value}
                    type='button'
                    onClick={() => setSelectedDuanjuTheme(theme.value)}
                    className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                      active
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {theme.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide'>
              <span className='text-[11px] text-gray-400 dark:text-gray-500 font-medium shrink-0'>
                地區:
              </span>
              {AREA_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type='button'
                  onClick={() => setSelectedArea(a.value)}
                  className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                    selectedArea === a.value
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {a.label}
                </button>
              ))}
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
