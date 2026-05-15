"use client";

import { useState, useCallback } from "react";
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

// 标签页接口
interface TabItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  closable: boolean;
}

export default function AdminClient() {
  
  // 布局状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: "dashboard",
      title: "仪表盘",
      icon: <LayoutDashboard className="w-4 h-4" />,
      content: <DashboardTab />,
      closable: false,
    },
  ]);

  const [isDragging, setIsDragging] = useState(false);  // 菜单配置
  const menuItems = [
    {
      id: "dashboard",
      title: "仪表盘",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: "images",
      title: "图片管理",
      icon: <ImageIcon className="w-5 h-5" />,
    },
    {
      id: "review",
      title: "审核管理",
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      id: "users",
      title: "用户管理",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "categories",
      title: "分类管理",
      icon: <FolderTree className="w-5 h-5" />,
    },
    {
      id: "notifications",
      title: "通知管理",
      icon: <Bell className="w-5 h-5" />,
    },
    {
      id: "reports",
      title: "举报管理",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: "settings",
      title: "系统设置",
      icon: <Settings className="w-5 h-5" />,
    },
    {
      id: "crawl",
      title: "爬虫管理",
      icon: <Bug className="w-5 h-5" />,
    },
  ];

  // 切换标签页
  const switchTab = useCallback((tabId: string) => {
    const existingTab = tabs.find(tab => tab.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
      return;
    }

    // 创建新标签页
    const menuItem = menuItems.find(item => item.id === tabId);
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
  }, [tabs]);

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
          width: sidebarCollapsed ? "80px" : "260px",
        }}
        className={`fixed lg:relative top-0 left-0 h-screen bg-white border-r z-50 transition-all duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* 侧边栏头部 */}
        <div className="h-16 border-b flex items-center justify-between px-4">
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
              <PanelLeft className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 菜单列表 */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                switchTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                activeTab === item.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-mute)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
              }`}
            >
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium flex-1 text-left"
                >
                  {item.title}
                </motion.span>
              )}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded bg-[var(--color-ink)] text-white text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.title}
                </div>
              )}
            </button>
          ))}
        </nav>
      </motion.aside>

      {/* 主内容区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="h-16 bg-white border-b sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-[var(--color-ink)] hidden lg:block">
              {menuItems.find(item => item.id === activeTab)?.title || "管理后台"}
            </h1>
          </div>
        </header>

        {/* 标签页栏 */}
        <div className="bg-white border-b h-12 flex items-center px-4 overflow-x-auto hide-scrollbar">
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
                className={`h-full flex items-center gap-2 px-4 border-b-2 transition-all cursor-pointer group ${
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <div className="w-4 h-4 flex-shrink-0">
                  {tab.icon}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {tab.title}
                </span>
                {tab.closable && (
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-soft)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
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