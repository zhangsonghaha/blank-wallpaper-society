"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import {
  Image as ImageIcon,
  ChevronLeft,
  LayoutDashboard,
  ShieldCheck,
  Users,
  X,
  Menu,
  PanelLeft,
  Settings,
  FolderTree,
  Bell,
  FileText,
  Bug,
  BarChart3,
  Trophy,
  XCircle,
  Mail,
  ChevronDown,
  MenuIcon,
  UserCog,
  Megaphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import DashboardTab from "./DashboardTab";
import ImagesTab from "./ImagesTab";
import ReviewTab from "./ReviewTab";
import UsersTab from "./UsersTab";
import CategoriesTab from "./CategoriesTab";
import NotificationsTab from "./NotificationsTab";
import SettingsTab from "./SettingsTab";
import CrawlTab from "./CrawlTab";
import ReportTab from "./ReportTab";
import ApiUsageTab from "./ApiUsageTab";
import ChallengesTab from "./ChallengesTab";
import EmailTemplatesTab from "./EmailTemplatesTab";
import MenuManagementTab from "./MenuManagementTab";
import RoleManagementTab from "./RoleManagementTab";
import AnnouncementsTab from "./AnnouncementsTab";

// 标签页接口
interface TabItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  closable: boolean;
}

// 菜单组接口
interface MenuGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: {
    id: string;
    title: string;
    icon: React.ReactNode;
  }[];
}

export default function AdminClient() {
  
  // 布局状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["ops", "content", "system"]);
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: "dashboard",
      title: "仪表盘",
      icon: <LayoutDashboard className="w-4 h-4" />,
      content: <DashboardTab />,
      closable: false,
    },
  ]);

  const [isDragging, setIsDragging] = useState(false);

  // 菜单可见性/启用状态映射 (path -> { is_visible, is_enabled })
  const [menuVisibility, setMenuVisibility] = useState<Record<string, { is_visible: number; is_enabled: number }>>({});

  // 从数据库加载菜单可见性状态
  useEffect(() => {
    const loadMenuVisibility = () => {
      fetch("/api/admin/menus")
        .then(res => res.json())
        .then(data => {
          if (data.success && data.flat) {
            const map: Record<string, { is_visible: number; is_enabled: number }> = {};
            for (const menu of data.flat) {
              // 使用 path 作为 key，与 menuGroups 中 child.id 对应
              map[menu.path] = { is_visible: menu.is_visible, is_enabled: menu.is_enabled };
            }
            setMenuVisibility(map);
          }
        })
        .catch(() => {});
    };
    loadMenuVisibility();
    // 监听菜单变更事件（菜单管理页面触发）
    window.addEventListener("admin:menu-changed", loadMenuVisibility);
    return () => window.removeEventListener("admin:menu-changed", loadMenuVisibility);
  }, []);

  // 菜单分组配置
  const menuGroups: MenuGroup[] = [
    {
      id: "content",
      title: "内容管理",
      icon: <FolderTree className="w-4 h-4" />,
      children: [
        { id: "images", title: "图片管理", icon: <ImageIcon className="w-4 h-4" /> },
        { id: "categories", title: "分类管理", icon: <FolderTree className="w-4 h-4" /> },
        { id: "review", title: "审核管理", icon: <ShieldCheck className="w-4 h-4" /> },
        { id: "reports", title: "举报管理", icon: <FileText className="w-4 h-4" /> },
        { id: "crawl", title: "爬虫管理", icon: <Bug className="w-4 h-4" /> },
        { id: "challenges", title: "挑战赛管理", icon: <Trophy className="w-4 h-4" /> },
      ],
    },
    {
      id: "ops",
      title: "运营管理",
      icon: <BarChart3 className="w-4 h-4" />,
      children: [
        { id: "dashboard", title: "仪表盘", icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: "api-usage", title: "API用量", icon: <BarChart3 className="w-4 h-4" /> },
        { id: "email-templates", title: "邮件模板", icon: <Mail className="w-4 h-4" /> },
      ],
    },
    {
      id: "system",
      title: "系统管理",
      icon: <Settings className="w-4 h-4" />,
      children: [
        { id: "menu-management", title: "菜单管理", icon: <MenuIcon className="w-4 h-4" /> },
        { id: "role-management", title: "角色管理", icon: <UserCog className="w-4 h-4" /> },
        { id: "users", title: "用户管理", icon: <Users className="w-4 h-4" /> },
        { id: "announcements", title: "通知公告", icon: <Megaphone className="w-4 h-4" /> },
        { id: "settings", title: "系统设置", icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  // 根据菜单可见性过滤菜单项
  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    children: group.children.filter(child => {
      const vis = menuVisibility[child.id];
      // 如果没有数据库记录（菜单管理页面自身），默认显示
      if (!vis) return true;
      return vis.is_visible === 1 && vis.is_enabled === 1;
    }),
  })).filter(group => group.children.length > 0);

  // 获取所有菜单项的扁平列表（用于标题查找）
  const allMenuItems = filteredMenuGroups.flatMap(g => g.children);

  // 切换分组展开/折叠
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // 切换标签页
  const switchTab = useCallback((tabId: string) => {
    const existingTab = tabs.find(tab => tab.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
      return;
    }

    const menuItem = allMenuItems.find(item => item.id === tabId);
    if (!menuItem) return;

    let content: React.ReactNode;
    switch (tabId) {
      case "dashboard":
        content = <DashboardTab />;
        break;
      case "images":
        content = <ImagesTab />;
        break;
      case "review":
        content = <ReviewTab />;
        break;
      case "users":
        content = <UsersTab />;
        break;
      case "categories":
        content = <CategoriesTab />;
        break;
      case "notifications":
        content = <NotificationsTab />;
        break;
      case "reports":
        content = <ReportTab />;
        break;
      case "settings":
        content = <SettingsTab />;
        break;
      case "crawl":
        content = <CrawlTab />;
        break;
      case "api-usage":
        content = <ApiUsageTab />;
        break;
      case "challenges":
        content = <ChallengesTab />;
        break;
      case "email-templates":
        content = <EmailTemplatesTab />;
        break;
      case "menu-management":
        content = <MenuManagementTab />;
        break;
      case "role-management":
        content = <RoleManagementTab />;
        break;
      case "announcements":
        content = <AnnouncementsTab />;
        break;
      default:
        content = <div className="p-6">功能开发中...</div>;
    }

    const newTab: TabItem = {
      id: tabId,
      title: menuItem.title,
      icon: menuItem.icon,
      content,
      closable: tabId !== "dashboard",
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTab(tabId);
  }, [tabs, allMenuItems]);

  // 关闭标签页
  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabId === "dashboard") return;

    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    if (activeTab === tabId) {
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      setActiveTab(remainingTabs[remainingTabs.length - 1].id);
    }
  }, [activeTab, tabs]);

  // 关闭当前标签左边的所有标签
  const closeLeftTabs = useCallback((tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx <= 0) return;
    const keep = tabs.filter((t, i) => i >= idx || !t.closable);
    setTabs(keep);
    if (!keep.find(t => t.id === activeTab)) {
      setActiveTab(tabId);
    }
  }, [tabs, activeTab]);

  // 关闭当前标签右边的所有标签
  const closeRightTabs = useCallback((tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    const keep = tabs.filter((t, i) => i <= idx || !t.closable);
    setTabs(keep);
    if (!keep.find(t => t.id === activeTab)) {
      setActiveTab(tabId);
    }
  }, [tabs, activeTab]);

  // 关闭除当前标签外的所有可关闭标签
  const closeOtherTabs = useCallback((tabId: string) => {
    const keep = tabs.filter(t => !t.closable || t.id === tabId);
    setTabs(keep);
    if (!keep.find(t => t.id === activeTab)) {
      setActiveTab(tabId);
    }
  }, [tabs, activeTab]);

  // 关闭所有可关闭的标签
  const closeAllTabs = useCallback(() => {
    const keep = tabs.filter(t => !t.closable);
    setTabs(keep);
    setActiveTab(keep[keep.length - 1]?.id || "dashboard");
  }, [tabs]);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  // 监听仪表盘导航事件
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const tabId = (e as CustomEvent).detail;
      if (tabId) switchTab(tabId);
    };
    window.addEventListener("admin:navigate", handleNavigate);
    return () => window.removeEventListener("admin:navigate", handleNavigate);
  }, [switchTab]);

  // 点击其他区域关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-soft)] flex overflow-hidden">
      <Toaster position="top-right" richColors />

      {/* 移动端遮罩 */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* 侧边栏 */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed ? "64px" : "256px",
        }}
        className={`fixed top-0 left-0 h-screen bg-[var(--color-surface-soft)] border-r z-50 transition-all duration-300 flex flex-col ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* 侧边栏头部 */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg text-[var(--color-ink)]"
            >
              管理后台
            </motion.div>
          )}
          {sidebarCollapsed && (
            <div className="w-full flex justify-center">
              <PanelLeft className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 分组菜单列表 */}
        <nav className="p-2 overflow-y-auto flex-1 space-y-1">
          {filteredMenuGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.id);
            const hasActiveChild = group.children.some(c => c.id === activeTab);
            
            return (
              <div key={group.id}>
                {/* 分组标题 */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all group relative ${
                    hasActiveChild && !sidebarCollapsed
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "text-[var(--color-mute)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <div className="flex-shrink-0 w-5 h-5">
                    {group.icon}
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
                        {group.title}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                    </>
                  )}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 rounded bg-[var(--color-ink)] text-white text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                      {group.title}
                    </div>
                  )}
                </button>

                {/* 子菜单 */}
                <AnimatePresence initial={false}>
                  {isExpanded && !sidebarCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 pl-3 border-l border-[var(--color-surface-soft)] space-y-0.5 py-1">
                        {group.children.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              switchTab(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all text-sm ${
                              activeTab === item.id
                                ? "bg-[var(--color-primary)] text-white shadow-sm"
                                : "text-[var(--color-mute)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                            }`}
                          >
                            <div className="flex-shrink-0 w-4 h-4">
                              {item.icon}
                            </div>
                            <span className="font-medium truncate">
                              {item.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 折叠模式下显示子菜单提示 */}
                {sidebarCollapsed && (
                  <div className="space-y-0.5 mt-1">
                    {group.children.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          switchTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-center py-1.5 rounded-lg transition-all group relative ${
                          activeTab === item.id
                            ? "bg-[var(--color-primary)] text-white"
                            : "text-[var(--color-mute)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        <div className="w-4 h-4">
                          {item.icon}
                        </div>
                        <div className="absolute left-full ml-2 px-2 py-1 rounded bg-[var(--color-ink)] text-white text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.title}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </motion.aside>

      {/* 主内容区 */}
      <div
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[256px]"
        }`}
      >
        {/* 顶部导航栏 */}
        <header className="h-14 bg-white border-b sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-[var(--color-ink)] hidden lg:block">
              {allMenuItems.find(item => item.id === activeTab)?.title || "管理后台"}
            </h1>
          </div>
        </header>

        {/* 标签页栏 */}
        <div className="bg-white border-b h-10 flex items-center px-4 overflow-x-auto hide-scrollbar relative">
          <style jsx global>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .hide-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
          <div className="flex items-center gap-1 h-full">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
                className={`h-full flex items-center gap-1.5 px-3 border-b-2 transition-all cursor-pointer group text-sm ${
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <div className="w-3.5 h-3.5 flex-shrink-0">
                  {tab.icon}
                </div>
                <span className="font-medium whitespace-nowrap">
                  {tab.title}
                </span>
                {tab.closable && (
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-soft)] transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-xl border py-1 min-w-[160px] animate-in fade-in-0 zoom-in-95"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.tabId !== "dashboard" && (
                <button
                  onClick={() => {
                    closeTab(contextMenu.tabId, {} as React.MouseEvent);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <X className="w-4 h-4 text-[var(--color-mute)]" />
                  关闭标签
                </button>
              )}
              {tabs.findIndex(t => t.id === contextMenu.tabId) > 1 && (
                <button
                  onClick={() => {
                    closeLeftTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--color-mute)]" />
                  关闭左侧标签
                </button>
              )}
              {contextMenu.tabId !== tabs[tabs.length - 1]?.id && tabs.some((t, i) => i > tabs.findIndex(tt => tt.id === contextMenu.tabId) && t.closable) && (
                <button
                  onClick={() => {
                    closeRightTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--color-mute)] rotate-180" />
                  关闭右侧标签
                </button>
              )}
              {tabs.some(t => t.closable && t.id !== contextMenu.tabId) && (
                <button
                  onClick={() => {
                    closeOtherTabs(contextMenu.tabId);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <XCircle className="w-4 h-4 text-[var(--color-mute)]" />
                  关闭其他标签
                </button>
              )}
              {tabs.some(t => t.closable) && (
                <button
                  onClick={() => {
                    closeAllTabs();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  关闭全部标签
                </button>
              )}
            </div>
          )}
        </div>

        {/* 内容区 */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {tabs.find(tab => tab.id === activeTab)?.content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}