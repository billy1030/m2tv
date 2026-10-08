/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  Settings,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { GripVertical } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';

import { AdminConfig, AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';

// 统一弹窗方法（必须在首次使用前定义）
const showError = (message: string) =>
  Swal.fire({ icon: 'error', title: '错误', text: message });

const showSuccess = (message: string) =>
  Swal.fire({
    icon: 'success',
    title: '成功',
    text: message,
    timer: 2000,
    showConfirmButton: false,
  });

// 新增站点配置类型
interface SiteConfig {
  SiteName: string;
  Announcement: string;
  SearchDownstreamMaxPage: number;
  SiteInterfaceCacheTime: number;
  ImageProxy: string;
  DoubanProxy: string;
  DisableYellowFilter: boolean;
}

// 视频源数据类型
interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 自定义分类数据类型
interface CustomCategory {
  name?: string;
  type: 'movie' | 'tv';
  query: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 可折叠标签组件
interface CollapsibleTabProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleTab = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: CollapsibleTabProps) => {
  return (
    <div className='rounded-lg shadow-xs mb-2 overflow-hidden bg-white/80 backdrop-blur-md dark:bg-zinc-900/60 dark:ring-1 dark:ring-zinc-800'>
      <button
        onClick={onToggle}
        className='w-full px-3 sm:px-4 py-2 flex items-center justify-between bg-gray-50/70 dark:bg-zinc-800/50 hover:bg-gray-100/80 dark:hover:bg-zinc-700/50 transition-colors'
      >
        <div className='flex items-center gap-2'>
          {icon}
          <h3 className='text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200'>
            {title}
          </h3>
        </div>
        <div className='text-gray-500 dark:text-gray-400'>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isExpanded && <div className='px-3 sm:px-4 py-2.5'>{children}</div>}
    </div>
  );
};

// 用户配置组件
interface UserConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refreshConfig: () => Promise<void>;
}

const UserConfig = ({ config, role, refreshConfig }: UserConfigProps) => {
  const [userSettings, setUserSettings] = useState({
    enableRegistration: false,
  });
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
  });
  const [changePasswordUser, setChangePasswordUser] = useState({
    username: '',
    password: '',
  });

  // 当前登录用户名
  const currentUsername = getAuthInfoFromBrowserCookie()?.username || null;

  // 检测存储类型是否为 d1
  const isD1Storage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'd1';
  const isUpstashStorage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'upstash';

  useEffect(() => {
    if (config?.UserConfig) {
      setUserSettings({
        enableRegistration: config.UserConfig.AllowRegister,
      });
    }
  }, [config]);

  // 切换允许注册设置
  const toggleAllowRegister = async (value: boolean) => {
    try {
      // 先更新本地 UI
      setUserSettings((prev) => ({ ...prev, enableRegistration: value }));

      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setAllowRegister',
          allowRegister: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败');
      // revert toggle UI
      setUserSettings((prev) => ({ ...prev, enableRegistration: !value }));
    }
  };

  const handleBanUser = async (uname: string) => {
    await handleUserAction('ban', uname);
  };

  const handleUnbanUser = async (uname: string) => {
    await handleUserAction('unban', uname);
  };

  const handleSetAdmin = async (uname: string) => {
    await handleUserAction('setAdmin', uname);
  };

  const handleRemoveAdmin = async (uname: string) => {
    await handleUserAction('cancelAdmin', uname);
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    await handleUserAction('add', newUser.username, newUser.password);
    setNewUser({ username: '', password: '' });
    setShowAddUserForm(false);
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser.username || !changePasswordUser.password) return;
    await handleUserAction(
      'changePassword',
      changePasswordUser.username,
      changePasswordUser.password
    );
    setChangePasswordUser({ username: '', password: '' });
    setShowChangePasswordForm(false);
  };

  const handleShowChangePasswordForm = (username: string) => {
    setChangePasswordUser({ username, password: '' });
    setShowChangePasswordForm(true);
    setShowAddUserForm(false); // 关闭添加用户表单
  };

  const handleDeleteUser = async (username: string) => {
    const { isConfirmed } = await Swal.fire({
      title: '确认删除用户',
      text: `删除用户 ${username} 将同时删除其搜索历史、播放记录和收藏夹，此操作不可恢复！`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#dc2626',
    });

    if (!isConfirmed) return;

    await handleUserAction('deleteUser', username);
  };

  // 通用请求函数
  const handleUserAction = async (
    action:
      | 'add'
      | 'ban'
      | 'unban'
      | 'setAdmin'
      | 'cancelAdmin'
      | 'changePassword'
      | 'deleteUser',
    targetUsername: string,
    targetPassword?: string
  ) => {
    try {
      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername,
          ...(targetPassword ? { targetPassword } : {}),
          action,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      // 成功后刷新配置（无需整页刷新）
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败');
    }
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {/* 统计与注册设置并排紧凑 */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        <div className='p-2.5 bg-green-50/80 dark:bg-green-900/20 rounded-lg border border-green-200/60 dark:border-green-800/60 flex items-center justify-between'>
          <div className='text-xs text-green-700 dark:text-green-300 font-medium'>
            總用戶數
          </div>
          <div className='text-lg font-bold text-green-800 dark:text-green-200'>
            {config.UserConfig.Users.length}
          </div>
        </div>

        <div className='p-2.5 bg-gray-50/80 dark:bg-zinc-900/40 rounded-lg border border-gray-200/60 dark:border-zinc-800/60 flex items-center justify-between'>
          <label
            className={`text-xs text-gray-700 dark:text-gray-300 font-medium ${
              isD1Storage || isUpstashStorage ? 'opacity-50' : ''
            }`}
          >
            允許新用戶註冊
          </label>
          <button
            onClick={() =>
              !isD1Storage &&
              !isUpstashStorage &&
              toggleAllowRegister(!userSettings.enableRegistration)
            }
            disabled={isD1Storage || isUpstashStorage}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-green-500 ${
              userSettings.enableRegistration
                ? 'bg-green-600'
                : 'bg-gray-200 dark:bg-zinc-700'
            } ${
              isD1Storage || isUpstashStorage
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                userSettings.enableRegistration
                  ? 'translate-x-4'
                  : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-xs font-medium text-gray-700 dark:text-gray-300'>
            用戶列表
          </h4>
          <button
            onClick={() => {
              setShowAddUserForm(!showAddUserForm);
              if (showChangePasswordForm) {
                setShowChangePasswordForm(false);
                setChangePasswordUser({ username: '', password: '' });
              }
            }}
            className='px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors'
          >
            {showAddUserForm ? '取消' : '添加用戶'}
          </button>
        </div>

        {/* 添加用户表单 */}
        {showAddUserForm && (
          <div className='mb-3 p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700'>
            <div className='flex flex-col sm:flex-row gap-2'>
              <input
                type='text'
                placeholder='用戶名'
                value={newUser.username}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, username: e.target.value }))
                }
                className='flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500'
              />
              <input
                type='password'
                placeholder='密碼'
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, password: e.target.value }))
                }
                className='flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500'
              />
              <button
                onClick={handleAddUser}
                disabled={!newUser.username || !newUser.password}
                className='px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors'
              >
                添加
              </button>
            </div>
          </div>
        )}

        {/* 修改密码表单 */}
        {showChangePasswordForm && (
          <div className='mb-3 p-3 bg-blue-50/70 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
            <h5 className='text-xs font-medium text-blue-800 dark:text-blue-300 mb-2'>
              修改用戶密碼
            </h5>
            <div className='flex flex-col sm:flex-row gap-2'>
              <input
                type='text'
                placeholder='用戶名'
                value={changePasswordUser.username}
                disabled
                className='flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 cursor-not-allowed'
              />
              <input
                type='password'
                placeholder='新密碼'
                value={changePasswordUser.password}
                onChange={(e) =>
                  setChangePasswordUser((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className='flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500'
              />
              <button
                onClick={handleChangePassword}
                disabled={!changePasswordUser.password}
                className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors'
              >
                修改
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className='px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors'
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-zinc-900'>
              <tr>
                <th
                  scope='col'
                  className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  用戶名
                </th>
                <th
                  scope='col'
                  className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  角色
                </th>
                <th
                  scope='col'
                  className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  狀態
                </th>
                <th
                  scope='col'
                  className='px-3 py-1.5 text-right text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  操作
                </th>
              </tr>
            </thead>
            {/* 按规则排序用户：自己 -> 站长(若非自己) -> 管理员 -> 其他 */}
            {(() => {
              const sortedUsers = [...config.UserConfig.Users].sort((a, b) => {
                type UserInfo = (typeof config.UserConfig.Users)[number];
                const priority = (u: UserInfo) => {
                  if (u.username === currentUsername) return 0;
                  if (u.role === 'owner') return 1;
                  if (u.role === 'admin') return 2;
                  return 3;
                };
                return priority(a) - priority(b);
              });
              return (
                <tbody className='divide-y divide-gray-200 dark:divide-zinc-800'>
                  {sortedUsers.map((user) => {
                    // 修改密码权限：站长可修改管理员和普通用户密码，管理员可修改普通用户和自己的密码，但任何人都不能修改站长密码
                    const canChangePassword =
                      user.role !== 'owner' && // 不能修改站长密码
                      (role === 'owner' || // 站长可以修改管理员和普通用户密码
                        (role === 'admin' &&
                          (user.role === 'user' ||
                            user.username === currentUsername))); // 管理员可以修改普通用户和自己的密码

                    // 删除用户权限：站长可删除除自己外的所有用户，管理员仅可删除普通用户
                    const canDeleteUser =
                      user.username !== currentUsername &&
                      (role === 'owner' || // 站长可以删除除自己外的所有用户
                        (role === 'admin' && user.role === 'user')); // 管理员仅可删除普通用户

                    // 其他操作权限：不能操作自己，站长可操作所有用户，管理员可操作普通用户
                    const canOperate =
                      user.username !== currentUsername &&
                      (role === 'owner' ||
                        (role === 'admin' && user.role === 'user'));
                    return (
                      <tr
                        key={user.username}
                        className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors'
                      >
                        <td className='px-3 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100'>
                          {user.username}
                        </td>
                        <td className='px-3 py-1.5 whitespace-nowrap'>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded ${
                              user.role === 'owner'
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                : user.role === 'admin'
                                ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {user.role === 'owner'
                              ? '站長'
                              : user.role === 'admin'
                              ? '管理員'
                              : '普通用戶'}
                          </span>
                        </td>
                        <td className='px-3 py-1.5 whitespace-nowrap'>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded ${
                              !user.banned
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {!user.banned ? '正常' : '已封禁'}
                          </span>
                        </td>
                        <td className='px-3 py-1.5 whitespace-nowrap text-right text-xs font-medium space-x-1'>
                          {/* 修改密码按钮 */}
                          {canChangePassword && (
                            <button
                              onClick={() =>
                                handleShowChangePasswordForm(user.username)
                              }
                              className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 transition-colors'
                            >
                              改密
                            </button>
                          )}
                          {canOperate && (
                            <>
                              {/* 其他操作按钮 */}
                              {user.role === 'user' && (
                                <button
                                  onClick={() => handleSetAdmin(user.username)}
                                  className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 transition-colors'
                                >
                                  設管
                                </button>
                              )}
                              {user.role === 'admin' && (
                                <button
                                  onClick={() =>
                                    handleRemoveAdmin(user.username)
                                  }
                                  className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-300 transition-colors'
                                >
                                  撤管
                                </button>
                              )}
                              {user.role !== 'owner' &&
                                (!user.banned ? (
                                  <button
                                    onClick={() => handleBanUser(user.username)}
                                    className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 transition-colors'
                                  >
                                    封禁
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleUnbanUser(user.username)
                                    }
                                    className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 transition-colors'
                                  >
                                    解封
                                  </button>
                                ))}
                            </>
                          )}
                          {/* 删除用户按钮 */}
                          {canDeleteUser && (
                            <button
                              onClick={() => handleDeleteUser(user.username)}
                              className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors'
                            >
                              刪除
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })()}
          </table>
        </div>
      </div>
    </div>
  );
};

// 视频源配置组件
const VideoSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'config',
  });

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.SourceConfig) {
      setSources(config.SourceConfig);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败');
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    callSourceApi({ action, key }).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    callSourceApi({ action: 'delete', key }).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) return;
    callSourceApi({
      action: 'add',
      key: newSource.key,
      name: newSource.name,
      api: newSource.api,
      detail: newSource.detail,
    })
      .then(() => {
        setNewSource({
          name: '',
          key: '',
          api: '',
          detail: '',
          disabled: false,
          from: 'custom',
        });
        setShowAddForm(false);
      })
      .catch(() => {
        console.error('操作失败', 'add', newSource);
      });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sources.findIndex((s) => s.key === active.id);
    const newIndex = sources.findIndex((s) => s.key === over.id);
    setSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = sources.map((s) => s.key);
    callSourceApi({ action: 'sort', order })
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ source }: { source: DataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: source.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors select-none'
      >
        <td
          className='px-1.5 py-1.5 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100'>
          {source.name}
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100'>
          {source.key}
        </td>
        <td
          className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={source.api}
        >
          {source.api}
        </td>
        <td
          className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={source.detail || '-'}
        >
          {source.detail || '-'}
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              !source.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!source.disabled ? '啟用' : '已禁用'}
          </span>
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-right text-xs font-medium space-x-1'>
          <button
            onClick={() => handleToggleEnable(source.key)}
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
              !source.disabled
                ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300'
                : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300'
            } transition-colors`}
          >
            {!source.disabled ? '禁用' : '啟用'}
          </button>
          {source.from !== 'config' && (
            <button
              onClick={() => handleDelete(source.key)}
              className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-300 transition-colors'
            >
              刪除
            </button>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-xs text-gray-500 dark:text-gray-400'>
        加載中...
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {/* 添加视频源表单 */}
      <div className='flex items-center justify-between'>
        <h4 className='text-xs font-medium text-gray-700 dark:text-gray-300'>
          視頻源列表
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className='px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors'
        >
          {showAddForm ? '取消' : '添加視頻源'}
        </button>
      </div>

      {showAddForm && (
        <div className='p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 space-y-2'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            <input
              type='text'
              placeholder='名稱'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newSource.key}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='API 地址'
              value={newSource.api}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, api: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Detail 地址（選填）'
              value={newSource.detail}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, detail: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddSource}
              disabled={!newSource.name || !newSource.key || !newSource.api}
              className='px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors'
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 视频源表格 */}
      <div className='border border-gray-200 dark:border-zinc-700 rounded-lg max-h-[24rem] overflow-y-auto overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-zinc-800'>
          <thead className='bg-gray-50 dark:bg-zinc-900'>
            <tr>
              <th className='w-6' />
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                名稱
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Key
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                API 地址
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Detail 地址
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                狀態
              </th>
              <th className='px-3 py-1.5 text-right text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={sources.map((s) => s.key)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {sources.map((source) => (
                  <DraggableRow key={source.key} source={source} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            className='px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
          >
            保存排序
          </button>
        </div>
      )}
    </div>
  );
};

// 分类配置组件
const CategoryConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'config',
  });

  // 检测存储类型是否为 d1 或 upstash
  const isD1Storage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'd1';
  const isUpstashStorage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'upstash';

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.CustomCategories) {
      setCategories(config.CustomCategories);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callCategoryApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败');
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    callCategoryApi({ action, query, type }).catch(() => {
      console.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    callCategoryApi({ action: 'delete', query, type }).catch(() => {
      console.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.query) return;
    callCategoryApi({
      action: 'add',
      name: newCategory.name,
      type: newCategory.type,
      query: newCategory.query,
    })
      .then(() => {
        setNewCategory({
          name: '',
          type: 'movie',
          query: '',
          disabled: false,
          from: 'custom',
        });
        setShowAddForm(false);
      })
      .catch(() => {
        console.error('操作失败', 'add', newCategory);
      });
  };

  const handleDragEnd = (event: any) => {
    if (isD1Storage || isUpstashStorage) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === active.id
    );
    const newIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === over.id
    );
    setCategories((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = categories.map((c) => `${c.query}:${c.type}`);
    callCategoryApi({ action: 'sort', order })
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ category }: { category: CustomCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: `${category.query}:${category.type}` });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors select-none'
      >
        <td
          className={`px-1.5 py-1.5 ${
            isD1Storage || isUpstashStorage
              ? 'text-gray-200'
              : 'cursor-grab text-gray-400'
          }`}
          style={{ touchAction: 'none' }}
          {...(isD1Storage || isUpstashStorage
            ? {}
            : { ...attributes, ...listeners })}
        >
          <GripVertical size={14} />
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100'>
          {category.name || '-'}
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100'>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              category.type === 'movie'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
            }`}
          >
            {category.type === 'movie' ? '電影' : '電視劇'}
          </span>
        </td>
        <td
          className='px-3 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={category.query}
        >
          {category.query}
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              !category.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!category.disabled ? '啟用' : '已禁用'}
          </span>
        </td>
        <td className='px-3 py-1.5 whitespace-nowrap text-right text-xs font-medium space-x-1'>
          <button
            onClick={() =>
              !isD1Storage &&
              !isUpstashStorage &&
              handleToggleEnable(category.query, category.type)
            }
            disabled={isD1Storage || isUpstashStorage}
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
              isD1Storage || isUpstashStorage
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : !category.disabled
                ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300'
                : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300'
            } transition-colors`}
          >
            {!category.disabled ? '禁用' : '啟用'}
          </button>
          {category.from !== 'config' && !isD1Storage && !isUpstashStorage && (
            <button
              onClick={() => handleDelete(category.query, category.type)}
              className='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-300 transition-colors'
            >
              刪除
            </button>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-xs text-gray-500 dark:text-gray-400'>
        加載中...
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {/* 添加分类表单 */}
      <div className='flex items-center justify-between'>
        <h4 className='text-xs font-medium text-gray-700 dark:text-gray-300'>
          自定義分類列表
          {isD1Storage && (
            <span className='ml-2 text-[10px] text-gray-500 dark:text-gray-400'>
              (D1 環境請通過配置文件修改)
            </span>
          )}
          {isUpstashStorage && (
            <span className='ml-2 text-[10px] text-gray-500 dark:text-gray-400'>
              (Upstash 環境請通過配置文件修改)
            </span>
          )}
        </h4>
        <button
          onClick={() =>
            !isD1Storage && !isUpstashStorage && setShowAddForm(!showAddForm)
          }
          disabled={isD1Storage || isUpstashStorage}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            isD1Storage || isUpstashStorage
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {showAddForm ? '取消' : '添加分類'}
        </button>
      </div>

      {showAddForm && !isD1Storage && !isUpstashStorage && (
        <div className='p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 space-y-2'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
            <input
              type='text'
              placeholder='分類名稱'
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
            <select
              value={newCategory.type}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  type: e.target.value as 'movie' | 'tv',
                }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            >
              <option value='movie'>電影</option>
              <option value='tv'>電視劇</option>
            </select>
            <input
              type='text'
              placeholder='搜索關鍵詞'
              value={newCategory.query}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, query: e.target.value }))
              }
              className='px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddCategory}
              disabled={!newCategory.name || !newCategory.query}
              className='px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded-lg transition-colors'
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 分类表格 */}
      <div className='border border-gray-200 dark:border-zinc-700 rounded-lg max-h-[24rem] overflow-y-auto overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-zinc-800'>
          <thead className='bg-gray-50 dark:bg-zinc-900'>
            <tr>
              <th className='w-6' />
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                分類名稱
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                類型
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                搜索關鍵詞
              </th>
              <th className='px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                狀態
              </th>
              <th className='px-3 py-1.5 text-right text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={isD1Storage || isUpstashStorage ? [] : sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={categories.map((c) => `${c.query}:${c.type}`)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {categories.map((category) => (
                  <DraggableRow
                    key={`${category.query}:${category.type}`}
                    category={category}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && !isD1Storage && !isUpstashStorage && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            className='px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
          >
            保存排序
          </button>
        </div>
      )}
    </div>
  );
};

// 新增站点配置组件
const SiteConfigComponent = ({ config }: { config: AdminConfig | null }) => {
  const [siteSettings, setSiteSettings] = useState<SiteConfig>({
    SiteName: '',
    Announcement: '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 7200,
    ImageProxy: '',
    DoubanProxy: '',
    DisableYellowFilter: false,
  });
  // 保存状态
  const [saving, setSaving] = useState(false);

  // 检测存储类型是否为 d1 或 upstash
  const isD1Storage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'd1';
  const isUpstashStorage =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE === 'upstash';

  useEffect(() => {
    if (config?.SiteConfig) {
      setSiteSettings({
        ...config.SiteConfig,
        ImageProxy: config.SiteConfig.ImageProxy || '',
        DoubanProxy: config.SiteConfig.DoubanProxy || '',
        DisableYellowFilter: config.SiteConfig.DisableYellowFilter || false,
      });
    }
  }, [config]);

  // 保存站点配置
  const handleSave = async () => {
    try {
      setSaving(true);
      const resp = await fetch('/api/admin/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...siteSettings }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `保存失败: ${resp.status}`);
      }

      showSuccess('保存成功, 请刷新页面');
    } catch (err) {
      showError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {/* 站点名称 */}
      <div>
        <label
          className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${
            isD1Storage || isUpstashStorage ? 'opacity-50' : ''
          }`}
        >
          站点名称
          {isD1Storage && (
            <span className='ml-1 text-[10px] text-gray-500 dark:text-gray-400'>
              (D1 环境请通过环境变量修改)
            </span>
          )}
          {isUpstashStorage && (
            <span className='ml-1 text-[10px] text-gray-500 dark:text-gray-400'>
              (Upstash 环境请通过环境变量修改)
            </span>
          )}
        </label>
        <input
          type='text'
          value={siteSettings.SiteName}
          onChange={(e) =>
            !isD1Storage &&
            !isUpstashStorage &&
            setSiteSettings((prev) => ({ ...prev, SiteName: e.target.value }))
          }
          disabled={isD1Storage || isUpstashStorage}
          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent ${
            isD1Storage || isUpstashStorage
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        />
      </div>

      {/* 站点公告 */}
      <div>
        <label
          className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${
            isD1Storage || isUpstashStorage ? 'opacity-50' : ''
          }`}
        >
          站点公告
          {isD1Storage && (
            <span className='ml-1 text-[10px] text-gray-500 dark:text-gray-400'>
              (D1 环境请通过环境变量修改)
            </span>
          )}
          {isUpstashStorage && (
            <span className='ml-1 text-[10px] text-gray-500 dark:text-gray-400'>
              (Upstash 环境请通过环境变量修改)
            </span>
          )}
        </label>
        <textarea
          value={siteSettings.Announcement}
          onChange={(e) =>
            !isD1Storage &&
            !isUpstashStorage &&
            setSiteSettings((prev) => ({
              ...prev,
              Announcement: e.target.value,
            }))
          }
          disabled={isD1Storage || isUpstashStorage}
          rows={2}
          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent ${
            isD1Storage || isUpstashStorage
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        />
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {/* 搜索接口可拉取最大页数 */}
        <div>
          <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
            搜索接口最大拉取页数
          </label>
          <input
            type='number'
            min={1}
            value={siteSettings.SearchDownstreamMaxPage}
            onChange={(e) =>
              setSiteSettings((prev) => ({
                ...prev,
                SearchDownstreamMaxPage: Number(e.target.value),
              }))
            }
            className='w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        {/* 站点接口缓存时间 */}
        <div>
          <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
            接口缓存时间（秒）
          </label>
          <input
            type='number'
            min={1}
            value={siteSettings.SiteInterfaceCacheTime}
            onChange={(e) =>
              setSiteSettings((prev) => ({
                ...prev,
                SiteInterfaceCacheTime: Number(e.target.value),
              }))
            }
            className='w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent'
          />
        </div>
      </div>

      {/* 图片代理 */}
      <div>
        <label
          className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${
            isD1Storage || isUpstashStorage ? 'opacity-50' : ''
          }`}
        >
          图片代理前缀
        </label>
        <input
          type='text'
          placeholder='例如: https://imageproxy.example.com/?url='
          value={siteSettings.ImageProxy}
          onChange={(e) =>
            !isD1Storage &&
            !isUpstashStorage &&
            setSiteSettings((prev) => ({
              ...prev,
              ImageProxy: e.target.value,
            }))
          }
          disabled={isD1Storage || isUpstashStorage}
          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent ${
            isD1Storage || isUpstashStorage
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        />
      </div>

      {/* 精选榜单/元数据代理设置 */}
      <div>
        <label
          className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${
            isD1Storage || isUpstashStorage ? 'opacity-50' : ''
          }`}
        >
          豆瓣 / 元数据代理地址
        </label>
        <input
          type='text'
          placeholder='例如: https://proxy.example.com/fetch?url='
          value={siteSettings.DoubanProxy}
          onChange={(e) =>
            !isD1Storage &&
            !isUpstashStorage &&
            setSiteSettings((prev) => ({
              ...prev,
              DoubanProxy: e.target.value,
            }))
          }
          disabled={isD1Storage || isUpstashStorage}
          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-green-500 focus:border-transparent ${
            isD1Storage || isUpstashStorage
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        />
      </div>

      {/* 禁用黄色过滤器 */}
      <div className='flex items-center justify-between py-1'>
        <div>
          <label
            className={`block text-xs font-medium text-gray-700 dark:text-gray-300 ${
              isD1Storage || isUpstashStorage ? 'opacity-50' : ''
            }`}
          >
            禁用黃色內容過濾器
          </label>
          <p className='text-[10px] text-gray-400'>允許顯示所有內容。</p>
        </div>
        <button
          type='button'
          onClick={() =>
            !isD1Storage &&
            !isUpstashStorage &&
            setSiteSettings((prev) => ({
              ...prev,
              DisableYellowFilter: !prev.DisableYellowFilter,
            }))
          }
          disabled={isD1Storage || isUpstashStorage}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-green-500 ${
            siteSettings.DisableYellowFilter
              ? 'bg-green-600'
              : 'bg-gray-200 dark:bg-zinc-700'
          } ${
            isD1Storage || isUpstashStorage
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              siteSettings.DisableYellowFilter
                ? 'translate-x-4'
                : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* 操作按钮 */}
      <div className='flex justify-end pt-1'>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-3 py-1 text-xs font-medium rounded-lg text-white transition-colors shadow-xs ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {saving ? '保存中...' : '保存設置'}
        </button>
      </div>
    </div>
  );
};

function AdminPageClient() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [expandedTabs, setExpandedTabs] = useState<{ [key: string]: boolean }>({
    userConfig: false,
    videoSource: false,
    siteConfig: false,
    categoryConfig: false,
  });

  // 获取管理员配置
  // showLoading 用于控制是否在请求期间显示整体加载骨架。
  const fetchConfig = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await fetch(`/api/admin/config`);

      if (!response.ok) {
        const data = (await response.json()) as any;
        throw new Error(`获取配置失败: ${data.error}`);
      }

      const data = (await response.json()) as AdminConfigResult;
      setConfig(data.Config);
      setRole(data.Role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取配置失败';
      showError(msg);
      setError(msg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // 首次加载时显示骨架
    fetchConfig(true);
  }, [fetchConfig]);

  // 切换标签展开状态
  const toggleTab = (tabKey: string) => {
    setExpandedTabs((prev) => ({
      ...prev,
      [tabKey]: !prev[tabKey],
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出配置为 JSON
  const handleExportConfig = () => {
    if (!config) return;
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `m2tv-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('配置导出成功！');
  };

  // 导入/上传配置文件
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('无效的 JSON 配置文件格式');
      }

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `导入失败: ${res.status}`);
      }

      showSuccess('配置导入成功，已动态应用！');
      await fetchConfig(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : '配置文件导入失败');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 新增: 重置配置处理函数
  const handleResetConfig = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '确认重置配置',
      text: '此操作将重置用户封禁和管理员设置、自定义视频源，站点配置将重置为默认值，是否继续？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    });
    if (!isConfirmed) return;

    try {
      const response = await fetch(`/api/admin/reset`);
      if (!response.ok) {
        throw new Error(`重置失败: ${response.status}`);
      }
      showSuccess('重置成功，请刷新页面！');
    } catch (err) {
      showError(err instanceof Error ? err.message : '重置失败');
    }
  };

  if (loading) {
    return (
      <PageLayout activePath='/admin'>
        <div className='px-2 sm:px-6 pb-4 overflow-visible'>
          <div className='sticky top-0 z-30 -mx-2 sm:-mx-6 px-2 sm:px-6 py-2.5 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200/40 dark:border-gray-800/40 mb-3'>
            <h1 className='text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200'>
              管理員設置
            </h1>
          </div>
          <div className='space-y-2'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='h-10 bg-gray-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse'
              />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    // 错误已通过 SweetAlert2 展示，此处直接返回空
    return null;
  }

  return (
    <PageLayout activePath='/admin'>
      <div className='px-2 sm:px-6 pb-4 overflow-visible'>
        {/* 頂部標題欄：直接貼頂吸頂停留（top-0），零初始間距，完全無滑動跳動 */}
        <div className='sticky top-0 z-30 -mx-2 sm:-mx-6 px-2 sm:px-6 py-2.5 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200/40 dark:border-gray-800/40 mb-3'>
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            <h1 className='text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200'>
              管理員設置
            </h1>

            {/* 操作按鈕：全體靠左排 */}
            {config && (
              <div className='flex items-center gap-1.5 flex-wrap'>
                {role === 'owner' && (
                  <button
                    onClick={handleResetConfig}
                    className='px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors'
                  >
                    重置配置
                  </button>
                )}
                <input
                  type='file'
                  ref={fileInputRef}
                  accept='.json'
                  className='hidden'
                  onChange={handleImportFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className='flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs'
                  title='導入 config.json 或完整配置'
                >
                  <Upload size={13} />
                  導入配置
                </button>
                <button
                  onClick={handleExportConfig}
                  className='flex items-center gap-1 px-2.5 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs'
                  title='導出當前配置為 JSON'
                >
                  <Download size={13} />
                  導出配置
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 站点配置标签 */}
        <CollapsibleTab
          title='站点配置'
          icon={
            <Settings size={20} className='text-gray-600 dark:text-gray-400' />
          }
          isExpanded={expandedTabs.siteConfig}
          onToggle={() => toggleTab('siteConfig')}
        >
          <SiteConfigComponent config={config} />
        </CollapsibleTab>

        <div className='space-y-4'>
          {/* 用户配置标签 */}
          <CollapsibleTab
            title='用户配置'
            icon={
              <Users size={20} className='text-gray-600 dark:text-gray-400' />
            }
            isExpanded={expandedTabs.userConfig}
            onToggle={() => toggleTab('userConfig')}
          >
            <UserConfig
              config={config}
              role={role}
              refreshConfig={fetchConfig}
            />
          </CollapsibleTab>

          {/* 视频源配置标签 */}
          <CollapsibleTab
            title='视频源配置'
            icon={
              <Video size={20} className='text-gray-600 dark:text-gray-400' />
            }
            isExpanded={expandedTabs.videoSource}
            onToggle={() => toggleTab('videoSource')}
          >
            <VideoSourceConfig config={config} refreshConfig={fetchConfig} />
          </CollapsibleTab>

          {/* 分类配置标签 */}
          <CollapsibleTab
            title='分类配置'
            icon={
              <FolderOpen
                size={20}
                className='text-gray-600 dark:text-gray-400'
              />
            }
            isExpanded={expandedTabs.categoryConfig}
            onToggle={() => toggleTab('categoryConfig')}
          >
            <CategoryConfig config={config} refreshConfig={fetchConfig} />
          </CollapsibleTab>
        </div>
      </div>
    </PageLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageClient />
    </Suspense>
  );
}
