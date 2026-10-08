/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  CheckCircle2,
  Database,
  FileCode2,
  HardDriveUpload,
  KeyRound,
  RefreshCw,
  Server,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';

interface SystemStats {
  siteName: string;
  totalSources: number;
  activeSources: number;
  cacheTime: number;
  customCategoriesCount: number;
}

function SetupPageContent() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [password, setPassword] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 客户端双重检查：未登录直接跳转至登录页
    const auth = getAuthInfoFromBrowserCookie();
    if (!auth || (!auth.password && !auth.username)) {
      router.replace('/login?redirect=/setup');
      return;
    }

    if (auth.password) {
      setPassword(auth.password);
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch('/api/setup');
      if (res.status === 401) {
        router.replace('/login?redirect=/setup');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setJsonText(content);
      // Try to validate immediately to give feedback
      try {
        JSON.parse(content);
        Swal.fire({
          icon: 'success',
          title: '已读取配置文件',
          text: `文件: ${file.name} (${(file.size / 1024).toFixed(
            1
          )} KB) - 格式正确`,
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (parseErr) {
        Swal.fire({
          icon: 'warning',
          title: '文件已读取，但存在 JSON 语法问题',
          text: `请在下方编辑区检查格式: ${(parseErr as Error).message}`,
        });
      }
    } catch (readErr) {
      Swal.fire({
        icon: 'error',
        title: '读取文件失败',
        text: (readErr as Error).message,
      });
    } finally {
      // Clear file input value so selecting the same file again triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyConfig = async () => {
    if (!jsonText.trim()) {
      Swal.fire({
        icon: 'warning',
        title: '请提供配置内容',
        text: '请上传 config.json 文件或在文本框中粘贴 JSON 内容。',
      });
      return;
    }

    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(jsonText);
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'JSON 格式错误',
        text: '解析失败，请检查是否是规范合法的 JSON 格式。',
      });
      return;
    }

    try {
      setSubmitting(true);
      setSuccessInfo(null);

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setup-key': password.trim(),
        },
        body: JSON.stringify(parsedConfig),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      setSuccessInfo(data.message || '配置成功生效！');
      Swal.fire({
        icon: 'success',
        title: '生效成功！',
        text: data.message || '配置已动态应用并实时生效！',
      });

      await fetchStats();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: '导入失败',
        text: err.message || '无法应用配置，请核对密码与配置格式。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loadCurrentTemplate = () => {
    const template = {
      cache_time: 7200,
      api_site: {
        zy1: {
          api: 'https://json.heimuer.xyz/api.php/provide/vod',
          name: '极速节点 1',
          detail: 'https://heimuer.tv',
        },
        zy2: {
          api: 'http://cj.rycjapi.com/api.php/provide/vod',
          name: '极速节点 2',
        },
      },
    };
    setJsonText(JSON.stringify(template, null, 2));
  };

  return (
    <PageLayout activePath='/setup'>
      <div className='min-h-[calc(100vh-140px)] pb-6 px-3 sm:px-6 max-w-4xl mx-auto'>
        {/* Sticky Header: 吸頂不滾動 */}
        <div className='sticky top-0 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 bg-gray-50/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200/50 dark:border-zinc-800/50 mb-3 flex items-center justify-between'>
          <div className='flex items-center gap-2 sm:gap-3 min-w-0'>
            <h1 className='text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200 truncate'>
              動態配置嚮導
            </h1>

            {/* 進入高級後台：緊貼標題位置 */}
            <Link
              href='/admin'
              className='text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 transition-colors flex-shrink-0 ml-1'
            >
              進入高級後台
            </Link>
          </div>
        </div>

        {/* Current Status Cards - 紧凑小卡片 */}
        <div className='grid grid-cols-3 gap-2 sm:gap-3 mb-3'>
          <div className='bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg p-2 sm:p-2.5 border border-gray-100 dark:border-zinc-800 shadow-xs'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'>
                <Server size={14} />
              </div>
              <div className='min-w-0'>
                <div className='text-[10px] text-gray-400 dark:text-gray-400 truncate'>
                  站点名称
                </div>
                <div className='text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate'>
                  {loadingStats ? '...' : stats?.siteName}
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg p-2 sm:p-2.5 border border-gray-100 dark:border-zinc-800 shadow-xs'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'>
                <Database size={14} />
              </div>
              <div className='min-w-0'>
                <div className='text-[10px] text-gray-400 dark:text-gray-400 truncate'>
                  生效视频源
                </div>
                <div className='text-xs sm:text-sm font-medium text-green-600 dark:text-green-400 truncate'>
                  {loadingStats ? '...' : `${stats?.activeSources ?? 0} 个在线`}
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg p-2 sm:p-2.5 border border-gray-100 dark:border-zinc-800 shadow-xs'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'>
                <FileCode2 size={14} />
              </div>
              <div className='min-w-0'>
                <div className='text-[10px] text-gray-400 dark:text-gray-400 truncate'>
                  缓存时长
                </div>
                <div className='text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400 truncate'>
                  {loadingStats ? '...' : `${stats?.cacheTime ?? 7200} 秒`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <div className='bg-white dark:bg-zinc-900 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-zinc-800 shadow-xs space-y-3'>
          {/* Password Authorization */}
          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5'>
              <KeyRound size={13} className='text-amber-500' />
              授权管理密码
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='请输入站点 PASSWORD 密码'
              className='w-full px-2.5 py-1.5 rounded-lg text-xs border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950/60 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none transition-all'
            />
          </div>

          {/* Upload and Template Actions */}
          <div className='border-t border-gray-100 dark:border-zinc-800 pt-3'>
            <div className='flex flex-wrap items-center justify-between gap-2 mb-2'>
              <label className='text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5'>
                <Upload size={13} className='text-blue-500' />
                配置内容 (JSON)
              </label>

              <div className='flex items-center gap-1.5'>
                <input
                  type='file'
                  ref={fileInputRef}
                  accept='.json,application/json,text/plain'
                  onChange={handleFileUpload}
                  className='hidden'
                />
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  className='inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs rounded transition-colors cursor-pointer'
                >
                  <Upload size={11} />
                  从本地上传 config.json
                </button>
                <button
                  type='button'
                  onClick={loadCurrentTemplate}
                  className='inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs rounded transition-colors cursor-pointer'
                >
                  填入示例结构
                </button>
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  try {
                    const text = await file.text();
                    setJsonText(text);
                    JSON.parse(text);
                    Swal.fire({
                      icon: 'success',
                      title: '拖拽文件读取成功',
                      text: `文件: ${file.name}`,
                      timer: 1500,
                      showConfirmButton: false,
                    });
                  } catch (err) {
                    Swal.fire({
                      icon: 'warning',
                      title: '已读取拖拽文件',
                      text: '注意格式校验，请检查内容是否为标准 JSON',
                    });
                  }
                }
              }}
              className='relative'
            >
              <textarea
                rows={3}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='在此粘貼 config.json 的內容，或點擊上方「從本地上傳 config.json」按鈕，也可直接拖拽 .json 文件到這裡...'
                className='w-full min-h-[76px] font-mono text-[11px] leading-relaxed p-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-emerald-400 focus:ring-1 focus:ring-green-500 focus:outline-none transition-all resize-y'
              />
            </div>
          </div>

          {/* Success Banner */}
          {successInfo && (
            <div className='flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs'>
              <CheckCircle2 size={14} className='flex-shrink-0' />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className='flex items-center justify-end gap-2 pt-1'>
            <button
              type='button'
              onClick={() => {
                setJsonText('');
                setSuccessInfo(null);
              }}
              className='px-2.5 py-1 rounded text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'
            >
              清空
            </button>
            <button
              type='button'
              disabled={submitting}
              onClick={handleApplyConfig}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium text-white transition-all shadow-xs ${
                submitting
                  ? 'bg-green-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 active:scale-95'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw size={12} className='animate-spin' />
                  正在应用配置...
                </>
              ) : (
                <>
                  <HardDriveUpload size={12} />
                  立即导入并生效
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900'>
          <div className='flex items-center gap-3 text-gray-500 dark:text-gray-400'>
            <RefreshCw size={20} className='animate-spin text-green-500' />
            <span>加载中...</span>
          </div>
        </div>
      }
    >
      <SetupPageContent />
    </Suspense>
  );
}
