'use client';

import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Film,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface StatItem {
  name: string;
  count: number;
  percentage: number;
  param?: string;
}

interface StatsData {
  code: number;
  sampleCount: number;
  targetLimit: number;
  areas: StatItem[];
  types: StatItem[];
  years: StatItem[];
  sites: StatItem[];
}

interface LibraryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LibraryStatsModal({
  isOpen,
  onClose,
}: LibraryStatsModalProps) {
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/vod/stats?limit=1000');
      if (!res.ok) throw new Error('統計資料載入失敗');
      const json = await res.json();
      if (json.code === 200) {
        setData(json);
      } else {
        throw new Error(json.error || '載入失敗');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '無法取得真實統計';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !data && !loading) {
      fetchStats();
    }
  }, [isOpen, data, loading]);

  if (!isOpen) return null;

  const handleAreaClick = (param?: string) => {
    if (param) {
      router.push(`/library?area=${param}`);
      onClose();
    }
  };

  const handleTypeClick = (param?: string) => {
    if (param) {
      router.push(`/library?type=${param}`);
      onClose();
    }
  };

  const handleYearClick = (param?: string) => {
    if (param) {
      router.push(`/library?year=${param}`);
      onClose();
    }
  };

  return (
    <div className='fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200'>
      <div
        className='relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal 頂部 Header */}
        <div className='flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 backdrop-blur-sm'>
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center'>
              <BarChart3 className='w-5 h-5' />
            </div>
            <div>
              <h2 className='text-base sm:text-lg font-bold flex items-center gap-2'>
                片庫大數據抽樣統計分析
                {data && (
                  <span className='text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'>
                    實測 {data.sampleCount.toLocaleString()} 部真實卡片
                  </span>
                )}
              </h2>
              <p className='text-[11px] sm:text-xs text-gray-500 dark:text-gray-400'>
                從 4~9
                號片庫採集節點即時抽取真實資料，點擊標籤可直接在連結中索取篩選
              </p>
            </div>
          </div>

          <div className='flex items-center gap-1.5'>
            <button
              onClick={fetchStats}
              disabled={loading}
              title='重新整理統計'
              className='p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50'
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className='p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Modal 內容區 */}
        <div className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-6'>
          {loading && !data && (
            <div className='flex flex-col items-center justify-center py-24 gap-3'>
              <Loader2 className='w-8 h-8 animate-spin text-green-600' />
              <p className='text-sm text-gray-600 dark:text-gray-300 font-medium'>
                正在跨節點高速掃描 1,000 部真實片源卡片並計算分佈...
              </p>
              <p className='text-xs text-gray-400 dark:text-gray-500'>
                正在統計國家地區、年份與真實片種分佈
              </p>
            </div>
          )}

          {error && (
            <div className='p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm flex items-center justify-between'>
              <span>{error}</span>
              <button
                onClick={fetchStats}
                className='px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700'
              >
                重試
              </button>
            </div>
          )}

          {data && (
            <>
              {/* 1. 國家與地區分佈 */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm sm:text-base font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400'>
                    <Globe className='w-4 h-4' />
                    國家 / 地區分佈 (點擊可直接索取片源)
                  </h3>
                  <span className='text-[11px] text-gray-400'>
                    共抽出 {data.areas.length} 個主要地區
                  </span>
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'>
                  {data.areas.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => handleAreaClick(a.param)}
                      disabled={!a.param}
                      className={`group relative p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                        a.param
                          ? 'bg-emerald-50/50 hover:bg-emerald-100/70 border-emerald-200/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:border-emerald-800/50 cursor-pointer shadow-sm hover:shadow'
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-800/40 dark:border-gray-800 cursor-default'
                      }`}
                    >
                      <div className='flex items-center justify-between w-full mb-1'>
                        <span className='font-semibold text-xs sm:text-sm text-gray-800 dark:text-gray-200 truncate'>
                          {a.name}
                        </span>
                        <span className='text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded'>
                          {a.count} 部
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 dark:bg-gray-700 h-1 rounded-full overflow-hidden'>
                        <div
                          className='bg-emerald-500 h-full rounded-full transition-all duration-500'
                          style={{
                            width: `${Math.min(100, a.percentage * 2)}%`,
                          }}
                        />
                      </div>
                      <div className='flex items-center justify-between mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                        <span>佔比 {a.percentage}%</span>
                        {a.param && (
                          <span className='text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium'>
                            直接篩選 →
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 片種 / 類型分佈 */}
              <div className='space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm sm:text-base font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-400'>
                    <Film className='w-4 h-4' />
                    片種 / 類型分佈 (Top 16 實測分類)
                  </h3>
                  <span className='text-[11px] text-gray-400'>
                    點擊具體類別可直接跳轉索取
                  </span>
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                  {data.types.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handleTypeClick(t.param)}
                      disabled={!t.param}
                      className={`group p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                        t.param
                          ? 'bg-blue-50/50 hover:bg-blue-100/70 border-blue-200/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 dark:border-blue-800/50 cursor-pointer shadow-sm hover:shadow'
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-800/40 dark:border-gray-800 cursor-default'
                      }`}
                    >
                      <div className='flex items-center justify-between w-full mb-1'>
                        <span className='font-semibold text-xs sm:text-sm text-gray-800 dark:text-gray-200 truncate'>
                          {t.name}
                        </span>
                        <span className='text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 rounded'>
                          {t.count} 部
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 dark:bg-gray-700 h-1 rounded-full overflow-hidden'>
                        <div
                          className='bg-blue-500 h-full rounded-full transition-all duration-500'
                          style={{
                            width: `${Math.min(100, t.percentage * 2)}%`,
                          }}
                        />
                      </div>
                      <div className='flex items-center justify-between mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                        <span>佔比 {t.percentage}%</span>
                        {t.param && (
                          <span className='text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium'>
                            即時檢索 →
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. 上映年份與採集節點統計 */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800'>
                {/* 年份 */}
                <div className='space-y-2.5'>
                  <h3 className='text-sm font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-400'>
                    <Calendar className='w-4 h-4' />
                    年份分佈 (點擊年份直接篩選)
                  </h3>
                  <div className='flex flex-wrap gap-1.5'>
                    {data.years.map((y) => (
                      <button
                        key={y.name}
                        onClick={() => handleYearClick(y.param)}
                        className='px-2.5 py-1.5 rounded-lg border border-purple-200/70 bg-purple-50/60 dark:bg-purple-950/20 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs transition-colors flex items-center gap-1.5'
                      >
                        <span className='font-semibold text-purple-900 dark:text-purple-200'>
                          {y.name}
                        </span>
                        <span className='text-[10px] px-1 py-0.2 rounded bg-purple-200/80 dark:bg-purple-900 text-purple-800 dark:text-purple-300 font-bold'>
                          {y.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 節點分佈 */}
                <div className='space-y-2.5'>
                  <h3 className='text-sm font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400'>
                    <Server className='w-4 h-4' />
                    採集節點抽樣貢獻
                  </h3>
                  <div className='space-y-1.5'>
                    {data.sites.map((s) => (
                      <div
                        key={s.name}
                        className='flex items-center justify-between text-xs p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/60'
                      >
                        <span className='font-medium text-gray-700 dark:text-gray-300'>
                          {s.name}
                        </span>
                        <span className='text-amber-600 dark:text-amber-400 font-semibold'>
                          {s.count} 部 ({s.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal 底部 Footer */}
        <div className='px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 flex items-center justify-between text-xs text-gray-500'>
          <div className='flex items-center gap-1.5'>
            <CheckCircle2 className='w-4 h-4 text-green-600' />
            <span>
              所有統計資料皆源自真實節點卡片抽樣，點選任何標籤即可直接套用索取。
            </span>
          </div>
          <button
            onClick={onClose}
            className='px-4 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium transition-colors'
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
