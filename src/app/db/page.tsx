/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDoubanCategories, getDoubanList } from '@/lib/db.media.client';
import { DoubanItem, DoubanResult } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DbCardSkeleton';
import DoubanCustomSelector from '@/components/DbCustomSelector';
import DoubanSelector from '@/components/DbSelector';
import { useDisplayMode } from '@/components/DisplayModeContext';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const type = searchParams.get('type') || 'movie';

  // 获取 runtimeConfig 中的自定义分类数据
  const [customCategories, setCustomCategories] = useState<
    Array<{ name: string; type: 'movie' | 'tv'; query: string }>
  >([]);

  // 选择器状态 - 从 browser cache (localStorage) 读取，实现记住用户上次选择
  const [primarySelection, setPrimarySelection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`db_cached_primary_${type}`);
      if (cached) return cached;
    }
    return type === 'movie' ? '热门' : '';
  });
  const [secondarySelection, setSecondarySelection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`db_cached_secondary_${type}`);
      if (cached) return cached;
    }
    if (type === 'movie') return '全部';
    if (type === 'tv') return 'tv';
    if (type === 'show') return 'show';
    return '全部';
  });

  // 获取自定义分类数据
  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setCustomCategories(runtimeConfig.CUSTOM_CATEGORIES);
    }
  }, []);

  // 动态筛选状态与 Browser Cache（针对豆瓣电影、剧集、综艺）
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`db_filter_year_${type}`) || 'all';
    }
    return 'all';
  });

  const [selectedGenre, setSelectedGenre] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`db_filter_genre_${type}`) || 'all';
    }
    return 'all';
  });

  // Browser Cache 记住的历史使用过题材标签
  const [cachedGenreTags, setCachedGenreTags] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`db_custom_genres_${type}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  // 当选择不同子页面时，同步更新筛选状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelectedYear(localStorage.getItem(`db_filter_year_${type}`) || 'all');
      setSelectedGenre(
        localStorage.getItem(`db_filter_genre_${type}`) || 'all'
      );
      try {
        const stored = localStorage.getItem(`db_custom_genres_${type}`);
        setCachedGenreTags(stored ? JSON.parse(stored) : []);
      } catch (e) {
        setCachedGenreTags([]);
      }
    }
  }, [type]);

  // 当用户点击题材标签时，自动记录进 Browser Cache
  const handleSelectGenre = useCallback(
    (genre: string) => {
      setSelectedGenre(genre);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`db_filter_genre_${type}`, genre);
        if (genre !== 'all' && !cachedGenreTags.includes(genre)) {
          const updated = [...cachedGenreTags, genre].slice(-15);
          setCachedGenreTags(updated);
          localStorage.setItem(
            `db_custom_genres_${type}`,
            JSON.stringify(updated)
          );
        }
      }
    },
    [type, cachedGenreTags]
  );

  const handleSelectYear = useCallback(
    (year: string) => {
      setSelectedYear(year);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`db_filter_year_${type}`, year);
      }
    },
    [type]
  );

  // 初始化时标记选择器为准备好状态
  useEffect(() => {
    // 短暂延迟确保初始状态设置完成
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []); // 只在组件挂载时执行一次

  // type变化时立即重置selectorsReady（最高优先级）
  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true); // 立即显示loading状态
  }, [type]);

  // 当type变化时重置选择器状态
  useEffect(() => {
    if (type === 'custom' && customCategories.length > 0) {
      // 自定义分类模式：优先选择 movie，如果没有 movie 则选择 tv
      const types = Array.from(
        new Set(customCategories.map((cat) => cat.type))
      );
      if (types.length > 0) {
        // 优先选择 movie，如果没有 movie 则选择 tv
        let selectedType = types[0]; // 默认选择第一个
        if (types.includes('movie')) {
          selectedType = 'movie';
        } else {
          selectedType = 'tv';
        }
        setPrimarySelection(selectedType);

        // 设置选中类型的第一个分类的 query 作为二级选择
        const firstCategory = customCategories.find(
          (cat) => cat.type === selectedType
        );
        if (firstCategory) {
          setSecondarySelection(firstCategory.query);
        }
      }
    } else {
      // 从 browser cache 恢复上次在该 type 下的选择，没有则使用默认
      let pVal = type === 'movie' ? '热门' : '';
      let sVal =
        type === 'movie'
          ? '全部'
          : type === 'tv'
          ? 'tv'
          : type === 'show'
          ? 'show'
          : '全部';

      if (typeof window !== 'undefined') {
        const cachedP = localStorage.getItem(`db_cached_primary_${type}`);
        if (cachedP !== null) pVal = cachedP;
        const cachedS = localStorage.getItem(`db_cached_secondary_${type}`);
        if (cachedS !== null) sVal = cachedS;
      }

      setPrimarySelection(pVal);
      setSecondarySelection(sVal);
    }

    // 使用短暂延迟确保状态更新完成后标记选择器准备好
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [type, customCategories]);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 生成API请求参数的辅助函数
  const getRequestParams = useCallback(
    (pageStart: number) => {
      // 当type为tv或show时，kind统一为'tv'，category使用type本身
      if (type === 'tv' || type === 'show') {
        return {
          kind: 'tv' as const,
          category: type,
          type: secondarySelection,
          pageLimit: 25,
          pageStart,
        };
      }

      // 电影类型保持原逻辑
      return {
        kind: type as 'tv' | 'movie',
        category: primarySelection,
        type: secondarySelection,
        pageLimit: 25,
        pageStart,
      };
    },
    [type, primarySelection, secondarySelection]
  );

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      let data: DoubanResult;

      if (type === 'custom') {
        // 自定义分类模式：根据选中的一级和二级选项获取对应的分类
        const selectedCategory = customCategories.find(
          (cat) =>
            cat.type === primarySelection && cat.query === secondarySelection
        );

        if (selectedCategory) {
          data = await getDoubanList({
            tag: selectedCategory.query,
            type: selectedCategory.type,
            pageLimit: 25,
            pageStart: 0,
          });
        } else {
          throw new Error('没有找到对应的分类');
        }
      } else {
        data = await getDoubanCategories(getRequestParams(0));
      }

      if (data.code === 200) {
        setDoubanData(data.list);
        setHasMore(data.list.length === 25);
        setLoading(false);
      } else {
        throw new Error(data.message || '获取数据失败');
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    type,
    primarySelection,
    secondarySelection,
    getRequestParams,
    customCategories,
  ]);

  // 只在选择器准备好后才加载数据
  useEffect(() => {
    // 只有在选择器准备好时才开始加载
    if (!selectorsReady) {
      return;
    }

    // 重置页面状态
    setDoubanData([]);
    setCurrentPage(0);
    setHasMore(true);
    setIsLoadingMore(false);

    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 使用防抖机制加载数据，避免连续状态更新触发多次请求
    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100); // 100ms 防抖延迟

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    selectorsReady,
    type,
    primarySelection,
    secondarySelection,
    loadInitialData,
  ]);

  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    if (currentPage > 0) {
      const fetchMoreData = async () => {
        try {
          setIsLoadingMore(true);

          let data: DoubanResult;
          if (type === 'custom') {
            // 自定义分类模式：根据选中的一级和二级选项获取对应的分类
            const selectedCategory = customCategories.find(
              (cat) =>
                cat.type === primarySelection &&
                cat.query === secondarySelection
            );

            if (selectedCategory) {
              data = await getDoubanList({
                tag: selectedCategory.query,
                type: selectedCategory.type,
                pageLimit: 25,
                pageStart: currentPage * 25,
              });
            } else {
              throw new Error('没有找到对应的分类');
            }
          } else {
            data = await getDoubanCategories(
              getRequestParams(currentPage * 25)
            );
          }

          if (data.code === 200) {
            setDoubanData((prev) => [...prev, ...data.list]);
            setHasMore(data.list.length === 25);
          } else {
            throw new Error(data.message || '获取数据失败');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [
    currentPage,
    type,
    primarySelection,
    secondarySelection,
    customCategories,
  ]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    // 确保 loadingRef 存在
    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading]);

  // 处理选择器变化
  const handlePrimaryChange = useCallback(
    (value: string) => {
      // 只有当值真正改变时才设置loading状态
      if (value !== primarySelection) {
        setLoading(true);

        if (typeof window !== 'undefined') {
          localStorage.setItem(`db_cached_primary_${type}`, value);
        }

        // 如果是自定义分类模式，同时更新一级和二级选择器
        if (type === 'custom' && customCategories.length > 0) {
          const firstCategory = customCategories.find(
            (cat) => cat.type === value
          );
          if (firstCategory) {
            // 批量更新状态，避免多次触发数据加载
            setPrimarySelection(value);
            setSecondarySelection(firstCategory.query);
            if (typeof window !== 'undefined') {
              localStorage.setItem(
                `db_cached_secondary_${type}`,
                firstCategory.query
              );
            }
          } else {
            setPrimarySelection(value);
          }
        } else {
          setPrimarySelection(value);
        }
      }
    },
    [primarySelection, type, customCategories]
  );

  const handleSecondaryChange = useCallback(
    (value: string) => {
      // 只有当值真正改变时才设置loading状态
      if (value !== secondarySelection) {
        setLoading(true);
        setSecondarySelection(value);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`db_cached_secondary_${type}`, value);
        }
      }
    },
    [secondarySelection, type]
  );

  const getPageTitle = () => {
    // 根据 type 生成标题
    return type === 'movie'
      ? '豆瓣推介電影'
      : type === 'tv'
      ? '豆瓣推介劇集'
      : type === 'show'
      ? '豆瓣推介綜藝'
      : '自定義';
  };

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);

    const queryString = params.toString();
    const activePath = `/db${queryString ? `?${queryString}` : ''}`;
    return activePath;
  };

  // 默认常用题材
  const DEFAULT_GENRES: Record<string, string[]> = {
    movie: [
      '剧情',
      '喜剧',
      '动作',
      '科幻',
      '悬疑',
      '恐怖',
      '爱情',
      '动画',
      '犯罪',
      '惊悚',
    ],
    tv: [
      '剧情',
      '喜剧',
      '爱情',
      '古装',
      '悬疑',
      '犯罪',
      '都市',
      '科幻',
      '武侠',
      '真人秀',
    ],
    show: ['真人秀', '脱口秀', '音乐', '搞笑', '游戏', '竞技', '旅行', '美食'],
  };

  // 动态融合三层：默认常用 + Browser Cache 历史 + 当前片单实时发掘
  const dynamicGenres = useMemo(() => {
    const base = DEFAULT_GENRES[type] || ['剧情', '喜剧', '爱情', '动作'];
    // 发现当前片单中的题材
    const discovered = new Set<string>();
    doubanData.forEach((item) => {
      if (item.type) {
        item.type.split(/\s+/).forEach((t) => {
          if (t && t.length <= 6 && !base.includes(t)) {
            discovered.add(t);
          }
        });
      }
    });

    const allCustom = Array.from(
      new Set([...cachedGenreTags, ...Array.from(discovered)])
    );
    return [
      { label: '全部類型', value: 'all' },
      ...base.map((g) => ({ label: g, value: g })),
      ...allCustom
        .filter((g) => !base.includes(g))
        .map((g) => ({ label: g, value: g })),
    ];
  }, [type, doubanData, cachedGenreTags]);

  // 动态年份选项：涵盖新片至过往年份
  const dynamicYears = useMemo(() => {
    // 提取当前片单中出现的年份
    const yearsSet = new Set<string>();
    doubanData.forEach((item) => {
      if (item.year && /^\d{4}$/.test(item.year)) {
        yearsSet.add(item.year);
      }
    });

    const currentYear = new Date().getFullYear();
    const futureYear = (currentYear + 1).toString();

    return [
      { label: '全部年份', value: 'all' },
      { label: `${futureYear}年`, value: futureYear },
      { label: `${currentYear}年`, value: currentYear.toString() },
      { label: `${currentYear - 1}年`, value: (currentYear - 1).toString() },
      { label: `${currentYear - 2}年`, value: (currentYear - 2).toString() },
      {
        label: `${currentYear - 5}-${currentYear - 3}年`,
        value: `${currentYear - 5}-${currentYear - 3}`,
      },
      { label: '更早', value: 'earlier' },
    ];
  }, [doubanData]);

  // 根据当前选中的年份与类型进行客户端过滤
  const filteredDoubanData = useMemo(() => {
    return doubanData.filter((item) => {
      // 1. 年份过滤
      if (selectedYear !== 'all') {
        const itemYear = parseInt(item.year, 10);
        const currentYear = new Date().getFullYear();
        if (
          selectedYear === (currentYear + 1).toString() &&
          item.year !== (currentYear + 1).toString()
        )
          return false;
        if (
          selectedYear === currentYear.toString() &&
          item.year !== currentYear.toString()
        )
          return false;
        if (
          selectedYear === (currentYear - 1).toString() &&
          item.year !== (currentYear - 1).toString()
        )
          return false;
        if (
          selectedYear === (currentYear - 2).toString() &&
          item.year !== (currentYear - 2).toString()
        )
          return false;
        if (selectedYear === `${currentYear - 5}-${currentYear - 3}`) {
          if (
            isNaN(itemYear) ||
            itemYear < currentYear - 5 ||
            itemYear > currentYear - 3
          )
            return false;
        }
        if (selectedYear === 'earlier') {
          if (isNaN(itemYear) || itemYear >= currentYear - 5) return false;
        }
      }

      // 2. 题材/类型过滤
      if (selectedGenre !== 'all') {
        const itemType = item.type || '';
        if (!itemType.includes(selectedGenre)) return false;
      }

      return true;
    });
  }, [doubanData, selectedYear, selectedGenre]);

  const { mode, gridClass } = useDisplayMode();

  return (
    <PageLayout activePath={getActivePath()}>
      <div
        className={`px-2 sm:px-6 pb-2 sm:pb-4 overflow-visible ${
          mode === 'tv' ? 'max-w-none' : ''
        }`}
      >
        {/* 顶部标题栏：直接貼頂吸頂停留（top-0），零初始間距，完全無滑動跳動 */}
        <div className='sticky top-0 z-30 -mx-2 sm:-mx-6 px-2 sm:px-6 py-2.5 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200/40 dark:border-gray-800/40 transition-colors'>
          <div className='flex items-center justify-between pr-44 sm:pr-48'>
            <h1 className='text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200'>
              {getPageTitle()}
            </h1>
            {filteredDoubanData.length > 0 && (
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {selectedYear !== 'all' || selectedGenre !== 'all'
                  ? `篩選中：${filteredDoubanData.length} / ${doubanData.length} 部`
                  : `已載入 ${doubanData.length} 部`}
              </span>
            )}
          </div>
        </div>

        {/* 页面选择器：跟隨頁面捲動 */}
        <div className='mt-2.5 mb-3 sm:mb-4 space-y-2'>
          {/* 选择器组件 */}
          {type !== 'custom' ? (
            <div className='bg-white/60 dark:bg-gray-800/40 rounded-xl p-2 sm:p-3 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm'>
              <DoubanSelector
                type={type as 'movie' | 'tv' | 'show'}
                primarySelection={primarySelection}
                secondarySelection={secondarySelection}
                onPrimaryChange={handlePrimaryChange}
                onSecondaryChange={handleSecondaryChange}
              />
            </div>
          ) : (
            <div className='bg-white/60 dark:bg-gray-800/40 rounded-xl p-2 sm:p-3 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm'>
              <DoubanCustomSelector
                customCategories={customCategories}
                primarySelection={primarySelection}
                secondarySelection={secondarySelection}
                onPrimaryChange={handlePrimaryChange}
                onSecondaryChange={handleSecondaryChange}
              />
            </div>
          )}

          {/* Dynamic Filter 动态筛选栏（年份 + 类型） */}
          {type !== 'custom' && (
            <div className='bg-white/60 dark:bg-gray-800/40 rounded-xl p-2 sm:p-2.5 border border-gray-200/30 dark:border-gray-700/30 space-y-2 backdrop-blur-sm'>
              {/* 1. 动态类型/题材筛选 */}
              <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5'>
                <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0'>
                  類型:
                </span>
                {dynamicGenres.map((g) => {
                  const active = selectedGenre === g.value;
                  return (
                    <button
                      key={g.value}
                      type='button'
                      onClick={() => handleSelectGenre(g.value)}
                      className={`text-xs px-2.5 py-0.5 rounded-full transition-colors font-medium shrink-0 ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>

              {/* 2. 动态年份筛选 */}
              <div className='flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5'>
                <span className='text-[11px] text-gray-400 dark:text-gray-500 font-semibold shrink-0'>
                  年份:
                </span>
                {dynamicYears.map((y) => {
                  const active = selectedYear === y.value;
                  return (
                    <button
                      key={y.value}
                      type='button'
                      onClick={() => handleSelectYear(y.value)}
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
            </div>
          )}
        </div>

        {/* 内容展示区域 */}
        <div className='w-full mx-auto mt-3 sm:mt-4 overflow-visible'>
          {/* 内容网格 */}
          <div className={`justify-start ${gridClass}`}>
            {loading || !selectorsReady
              ? // 显示骨架屏
                skeletonData.map((index) => <DoubanCardSkeleton key={index} />)
              : // 显示实际数据
                filteredDoubanData.map((item, index) => (
                  <div key={`${item.title}-${index}`} className='w-full'>
                    <VideoCard
                      from='douban'
                      title={item.title}
                      poster={item.poster}
                      douban_id={item.id}
                      rate={item.rate}
                      year={item.year}
                      area={item.area}
                      type={
                        item.type ||
                        (type === 'movie'
                          ? '電影'
                          : type === 'tv'
                          ? '劇集'
                          : type === 'show'
                          ? '綜藝'
                          : '')
                      }
                    />
                  </div>
                ))}
            {!loading &&
              selectorsReady &&
              filteredDoubanData.length === 0 &&
              doubanData.length > 0 && (
                <div className='col-span-full text-center text-gray-500 py-12 dark:text-gray-400 text-sm'>
                  當前篩選條件下暫無匹配影片，可嘗試切換其他年份或類型
                </div>
              )}
          </div>

          {/* 加载更多指示器 */}
          {hasMore && !loading && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='flex justify-center mt-12 py-8'
            >
              {isLoadingMore && (
                <div className='flex items-center gap-2'>
                  <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
                  <span className='text-gray-600 dark:text-gray-400'>
                    載入中...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!hasMore && doubanData.length > 0 && (
            <div className='text-center text-gray-500 py-8'>已載入全部內容</div>
          )}

          {/* 空状态 */}
          {!loading && doubanData.length === 0 && (
            <div className='text-center text-gray-500 py-8'>暫無相關內容</div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function DoubanPage() {
  return (
    <Suspense>
      <DoubanPageClient />
    </Suspense>
  );
}
