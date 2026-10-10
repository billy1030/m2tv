/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Check,
  CheckCircle,
  Copy,
  Film,
  Heart,
  Link,
  PlayCircleIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import { useDisplayMode } from '@/components/DisplayModeContext';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';

interface VideoCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  progress?: number;
  year?: string;
  from: 'playrecord' | 'favorite' | 'search' | 'douban';
  currentEpisode?: number;
  douban_id?: string;
  onDelete?: () => void;
  rate?: string;
  items?: SearchResult[];
  type?: string;
  area?: string;
}

export default function VideoCard({
  id,
  title = '',
  query = '',
  poster = '',
  episodes,
  source,
  source_name,
  progress = 0,
  year,
  from,
  currentEpisode,
  douban_id,
  onDelete,
  rate,
  items,
  type = '',
  area,
}: VideoCardProps) {
  const router = useRouter();
  const { mode, copyLinkMode } = useDisplayMode();
  const isTv = mode === 'tv';
  const [favorited, setFavorited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isAggregate = from === 'search' && !!items?.length;

  const aggregateData = useMemo(() => {
    if (!isAggregate || !items) return null;
    const countMap = new Map<string | number, number>();
    const episodeCountMap = new Map<number, number>();
    items.forEach((item) => {
      if (item.douban_id && item.douban_id !== 0) {
        countMap.set(item.douban_id, (countMap.get(item.douban_id) || 0) + 1);
      }
      const len = item.episodes?.length || 0;
      if (len > 0) {
        episodeCountMap.set(len, (episodeCountMap.get(len) || 0) + 1);
      }
    });

    const getMostFrequent = <T extends string | number>(
      map: Map<T, number>
    ) => {
      let maxCount = 0;
      let result: T | undefined;
      map.forEach((cnt, key) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          result = key;
        }
      });
      return result;
    };

    return {
      first: items[0],
      mostFrequentDoubanId: getMostFrequent(countMap),
      mostFrequentEpisodes: getMostFrequent(episodeCountMap) || 0,
    };
  }, [isAggregate, items]);

  const actualTitle = aggregateData?.first.title ?? title;
  const actualPoster = aggregateData?.first.poster ?? poster;
  const actualSource = aggregateData?.first.source ?? source;
  const actualId = aggregateData?.first.id ?? id;
  const actualDoubanId = String(
    aggregateData?.mostFrequentDoubanId ?? douban_id
  );
  const actualEpisodes = aggregateData?.mostFrequentEpisodes ?? episodes;
  const actualYear = aggregateData?.first.year ?? year;
  const actualQuery = query || '';
  const actualSearchType = isAggregate
    ? aggregateData?.first.episodes?.length === 1
      ? 'movie'
      : 'tv'
    : type;

  // 获取收藏状态
  useEffect(() => {
    if (from === 'douban' || !actualSource || !actualId) return;

    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setFavorited(fav);
      } catch (err) {
        throw new Error('检查收藏状态失败');
      }
    };

    fetchFavoriteStatus();

    // 监听收藏状态更新事件
    const storageKey = generateStorageKey(actualSource, actualId);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        // 检查当前项目是否在新的收藏列表中
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      }
    );

    return unsubscribe;
  }, [from, actualSource, actualId]);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (from === 'douban' || !actualSource || !actualId) return;
      try {
        if (favorited) {
          // 如果已收藏，删除收藏
          await deleteFavorite(actualSource, actualId);
          setFavorited(false);
        } else {
          // 如果未收藏，添加收藏
          await saveFavorite(actualSource, actualId, {
            title: actualTitle,
            source_name: source_name || '',
            year: actualYear || '',
            cover: actualPoster,
            total_episodes: actualEpisodes ?? 1,
            save_time: Date.now(),
          });
          setFavorited(true);
        }
      } catch (err) {
        throw new Error('切换收藏状态失败');
      }
    },
    [
      from,
      actualSource,
      actualId,
      actualTitle,
      source_name,
      actualYear,
      actualPoster,
      actualEpisodes,
      favorited,
    ]
  );

  const handleDeleteRecord = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (from !== 'playrecord' || !actualSource || !actualId) return;
      try {
        await deletePlayRecord(actualSource, actualId);
        onDelete?.();
      } catch (err) {
        throw new Error('删除播放记录失败');
      }
    },
    [from, actualSource, actualId, onDelete]
  );

  const playRelativeUrl = useMemo(() => {
    if (from === 'douban') {
      return `/play?title=${encodeURIComponent(actualTitle.trim())}${
        actualYear ? `&year=${actualYear}` : ''
      }${actualSearchType ? `&stype=${actualSearchType}` : ''}`;
    }
    if (actualSource && actualId) {
      return `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
        actualTitle
      )}${actualYear ? `&year=${actualYear}` : ''}${
        isAggregate ? '&prefer=true' : ''
      }${
        actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
      }${actualSearchType ? `&stype=${actualSearchType}` : ''}`;
    }
    return '';
  }, [
    from,
    actualTitle,
    actualYear,
    actualSearchType,
    actualSource,
    actualId,
    isAggregate,
    actualQuery,
  ]);

  const handleCopyLink = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      setCopied(false);

      // 1. 如果已有聚合/现有 episodes 数据，直接提取第一集 m3u8
      let targetM3u8 = '';
      if (
        aggregateData?.first?.episodes &&
        aggregateData.first.episodes.length > 0
      ) {
        targetM3u8 = aggregateData.first.episodes[0];
      }

      // 2. 如果没有直接的 episodes，但有 actualSource 和 actualId，实时请求 /api/detail 获取真实 m3u8
      if (!targetM3u8 && actualSource && actualId) {
        try {
          const res = await fetch(
            `/api/detail?source=${actualSource}&id=${actualId}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.episodes && data.episodes.length > 0) {
              targetM3u8 = data.episodes[0];
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. 如果是豆瓣卡片（from === 'douban'）或尚无 M3U8，通过 /api/search 查询该片名匹配的真实播放源
      if (!targetM3u8 && actualTitle) {
        try {
          const searchRes = await fetch(
            `/api/search?q=${encodeURIComponent(actualTitle.trim())}`
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const results = (searchData?.results || []) as SearchResult[];
            // 优先匹配相同年份的结果，否则取第一个有有效播放链接的结果
            const matched =
              results.find(
                (r) =>
                  r.episodes?.length > 0 &&
                  r.title.replaceAll(' ', '').toLowerCase() ===
                    actualTitle.replaceAll(' ', '').toLowerCase() &&
                  (!actualYear || r.year === actualYear)
              ) || results.find((r) => r.episodes?.length > 0);

            if (matched && matched.episodes?.length > 0) {
              targetM3u8 = matched.episodes[0];
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. 兜底：如果所有资源源均未收录该视频，才复制播放页面链接
      const textToCopy =
        targetM3u8 ||
        (typeof window !== 'undefined' && playRelativeUrl
          ? `${window.location.origin}${playRelativeUrl}`
          : playRelativeUrl);

      if (!textToCopy) return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    },
    [
      actualId,
      actualSource,
      actualTitle,
      actualYear,
      aggregateData,
      playRelativeUrl,
    ]
  );

  const handleClick = useCallback(() => {
    // 仅在电脑模式 (desktop) 并且開啟複製模式時觸發複製，其他模式維持原點擊跳轉行為
    if (mode === 'desktop' && copyLinkMode) {
      handleCopyLink();
      return;
    }
    if (playRelativeUrl) {
      router.push(playRelativeUrl);
    }
  }, [copyLinkMode, handleCopyLink, mode, playRelativeUrl, router]);

  const config = useMemo(() => {
    const configs = {
      playrecord: {
        showSourceName: false,
        showProgress: true,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: true,
        showDoubanLink: false,
        showRating: false,
      },
      favorite: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: false,
        showDoubanLink: false,
        showRating: false,
      },
      search: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: !isAggregate,
        showCheckCircle: false,
        showDoubanLink: !!actualDoubanId,
        showRating: false,
      },
      douban: {
        showSourceName: false,
        showProgress: false,
        showPlayButton: true,
        showHeart: false,
        showCheckCircle: false,
        showDoubanLink: true,
        showRating: !!rate,
      },
    };
    return configs[from] || configs.search;
  }, [from, isAggregate, actualDoubanId, rate]);

  return (
    <div
      tabIndex={0}
      data-tv-focusable='true'
      className='group relative w-full rounded-lg bg-transparent cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-[500]'
      onClick={handleClick}
    >
      {/* 海报容器 */}
      <div className='relative aspect-[2/3] overflow-hidden rounded-lg'>
        {/* 骨架屏 */}
        {!isLoading && !imgError && (
          <ImagePlaceholder aspectRatio='aspect-[2/3]' />
        )}

        {/* 异常或无海报时的备用占位 */}
        {imgError || !actualPoster ? (
          <div className='absolute inset-0 bg-gray-200 dark:bg-gray-800 flex flex-col items-center justify-center p-3 text-center'>
            <Film className='w-10 h-10 text-gray-400 dark:text-gray-600 mb-2' />
            <span className='text-xs text-gray-500 dark:text-gray-400 line-clamp-2'>
              {actualTitle}
            </span>
          </div>
        ) : (
          /* 图片 */
          <Image
            src={processImageUrl(actualPoster)}
            alt={actualTitle}
            fill
            className='object-cover'
            referrerPolicy='no-referrer'
            onLoadingComplete={() => setIsLoading(true)}
            onError={() => {
              setImgError(true);
              setIsLoading(true);
            }}
          />
        )}

        {/* 悬浮遮罩 */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100' />

        {/* 播放按钮 */}
        {config.showPlayButton && (
          <div className='absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 ease-in-out delay-75 group-hover:opacity-100 group-hover:scale-100'>
            <PlayCircleIcon
              size={50}
              strokeWidth={0.8}
              className='text-white fill-transparent transition-all duration-300 ease-out hover:fill-green-500 hover:scale-[1.1]'
            />
          </div>
        )}

        {/* 操作按钮 */}
        {(config.showHeart || config.showCheckCircle) && (
          <div className='absolute bottom-3 right-3 flex gap-3 opacity-0 translate-y-2 transition-all duration-300 ease-in-out group-hover:opacity-100 group-hover:translate-y-0'>
            {config.showCheckCircle && (
              <CheckCircle
                onClick={handleDeleteRecord}
                size={20}
                className='text-white transition-all duration-300 ease-out hover:stroke-green-500 hover:scale-[1.1]'
              />
            )}
            {config.showHeart && (
              <Heart
                onClick={handleToggleFavorite}
                size={20}
                className={`transition-all duration-300 ease-out ${
                  favorited
                    ? 'fill-red-600 stroke-red-600'
                    : 'fill-transparent stroke-white hover:stroke-red-400'
                } hover:scale-[1.1]`}
              />
            )}
          </div>
        )}

        {/* 徽章 */}
        {config.showRating && rate && (
          <div className='absolute top-2 right-2 bg-pink-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ease-out group-hover:scale-110'>
            {rate}
          </div>
        )}

        {actualEpisodes && actualEpisodes > 1 && (
          <div className='absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md transition-all duration-300 ease-out group-hover:scale-110'>
            {currentEpisode
              ? `${currentEpisode}/${actualEpisodes}`
              : actualEpisodes}
          </div>
        )}

        {/* 複製連結按鈕 / 徽章（僅電腦模式且開啟複製模式或已複製時顯示） */}
        {mode === 'desktop' && playRelativeUrl && (copyLinkMode || copied) && (
          <button
            type='button'
            onClick={handleCopyLink}
            title={
              copied ? '已複製真實 M3U8 鏈接！' : '點擊複製真實視頻鏈接 (M3U8)'
            }
            className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold shadow-lg transition-all duration-200 animate-in fade-in zoom-in-95 ${
              copied
                ? 'bg-emerald-600 text-white scale-105'
                : 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-105 active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <Check size={13} className='stroke-[2.5]' />
                <span>已複製</span>
              </>
            ) : (
              <>
                <Copy size={13} className='stroke-[2.5]' />
                <span>複製</span>
              </>
            )}
          </button>
        )}

        {/* 豆瓣链接 (非複製模式下顯示) */}
        {config.showDoubanLink &&
          actualDoubanId &&
          !(mode === 'desktop' && (copyLinkMode || copied)) && (
            <a
              href={`https://movie.douban.com/subject/${actualDoubanId}`}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='absolute top-2 left-2 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out delay-100 group-hover:opacity-100 group-hover:translate-x-0'
            >
              <div className='bg-green-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md hover:bg-green-600 hover:scale-[1.1] transition-all duration-300 ease-out'>
                <Link size={16} />
              </div>
            </a>
          )}

        {/* 进度条（置于海报内底部，不撑高卡片） */}
        {config.showProgress && progress !== undefined && (
          <div className='absolute bottom-0 left-0 right-0 h-1 bg-black/40 overflow-hidden'>
            <div
              className='h-full bg-green-500 transition-all duration-500 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* 标题与来源 */}
      <div className={`text-center ${isTv ? 'mt-1' : 'mt-1.5'}`}>
        <div className='relative'>
          <span
            className={`block font-semibold truncate text-gray-900 dark:text-gray-100 transition-colors duration-300 ease-in-out group-hover:text-green-600 dark:group-hover:text-green-400 peer ${
              isTv ? 'text-[11px] leading-tight' : 'text-xs sm:text-sm'
            }`}
          >
            {actualTitle}
          </span>
          {/* 自定义 tooltip */}
          <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded shadow-lg opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-200 ease-out delay-100 whitespace-nowrap pointer-events-none'>
            {actualTitle}
            <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
          </div>
        </div>
        {/* 来源、年份与地区 */}
        <div
          className={`flex items-center justify-center gap-1 flex-wrap ${
            isTv ? 'mt-0.5' : 'mt-1'
          }`}
        >
          {actualYear && actualYear !== 'unknown' && (
            <span
              className={`inline-block font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60 ${
                isTv
                  ? 'text-[9px] px-1 py-0'
                  : 'text-[10px] sm:text-[11px] px-1.5 py-0.5'
              }`}
            >
              {actualYear}
            </span>
          )}
          {area && (
            <span
              className={`inline-block font-medium rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 ${
                isTv
                  ? 'text-[9px] px-1 py-0'
                  : 'text-[10px] sm:text-[11px] px-1.5 py-0.5'
              }`}
            >
              {area}
            </span>
          )}
          {type && !['movie', 'tv'].includes(type.toLowerCase()) && (
            <span
              className={`inline-block font-medium rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 ${
                isTv
                  ? 'text-[9px] px-1 py-0'
                  : 'text-[10px] sm:text-[11px] px-1.5 py-0.5'
              }`}
            >
              {type}
            </span>
          )}
          {config.showSourceName && source_name && (
            <span className='inline-block text-gray-500 dark:text-gray-400'>
              <span
                className={`inline-block border rounded border-gray-500/60 dark:border-gray-400/60 transition-all duration-300 ease-in-out group-hover:border-green-500/60 group-hover:text-green-600 dark:group-hover:text-green-400 ${
                  isTv
                    ? 'text-[9px] px-1 py-0'
                    : 'text-[10px] sm:text-xs px-1.5 py-0.5'
                }`}
              >
                {source_name}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
