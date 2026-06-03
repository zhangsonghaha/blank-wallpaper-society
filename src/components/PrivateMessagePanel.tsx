"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Send,
  X,
  ArrowLeft,
  Trash2,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// === 类型定义 ===
interface Conversation {
  id: number;
  created_at: string;
  updated_at: string;
  other_user_id: number;
  other_user_name: string;
  other_user_avatar: string | null;
  last_message_content: string | null;
  last_message_sender_id: number | null;
  last_message_created_at: string | null;
  unread_count: number | null;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: "text" | "image" | "system";
  is_read: number;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function PrivateMessagePanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [activeConvInfo, setActiveConvInfo] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = status === "authenticated";

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data || []);
      }
    } catch (err) {
      console.error("加载对话列表失败:", err);
    }
  }, [isLoggedIn]);

  // 加载未读消息数
  const loadUnreadCount = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/messages?action=unread");
      if (res.ok) {
        const data = await res.json();
        setTotalUnread(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("加载未读数失败:", err);
    }
  }, [isLoggedIn]);

  // 加载消息
  const loadMessages = useCallback(async (conversationId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data || []);
        // 更新对话列表的未读数
        loadConversations();
        loadUnreadCount();
      }
    } catch (err) {
      console.error("加载消息失败:", err);
    } finally {
      setLoading(false);
    }
  }, [loadConversations, loadUnreadCount]);

  // 发送消息
  const handleSend = async () => {
    if (!activeConversation || !messageInput.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation,
          content: messageInput.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setMessageInput("");
        // 更新对话列表
        loadConversations();
        // 滚动到底部
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        const data = await res.json();
        console.error("发送失败:", data.error);
      }
    } catch (err) {
      console.error("发送消息失败:", err);
    } finally {
      setSending(false);
    }
  };

  // 删除对话
  const handleDeleteConversation = async (conversationId: number) => {
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversation === conversationId) {
          setActiveConversation(null);
          setActiveConvInfo(null);
          setMessages([]);
        }
        loadUnreadCount();
      }
    } catch (err) {
      console.error("删除对话失败:", err);
    }
  };

  // 打开对话
  const openConversation = (conv: Conversation) => {
    setActiveConversation(conv.id);
    setActiveConvInfo(conv);
    loadMessages(conv.id);
    // 清除该对话的未读计数
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  // 返回对话列表
  const backToList = () => {
    setActiveConversation(null);
    setActiveConvInfo(null);
    setMessages([]);
  };

  // SSE 实时消息推送
  useEffect(() => {
    if (!isLoggedIn || !isOpen) return;

    // 连接 SSE
    const es = new EventSource("/api/messages/stream");
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      console.log("[PM] SSE connected");
    });

    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message" && data.message) {
          const msg = data.message as Message;
          // 如果当前正在查看该对话，直接添加消息
          if (activeConversation === msg.conversation_id) {
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
          // 更新未读数和对话列表
          loadConversations();
          loadUnreadCount();
        }
      } catch (err) {
        console.error("[PM] SSE message parse error:", err);
      }
    });

    es.onerror = () => {
      console.log("[PM] SSE connection error, will retry");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isLoggedIn, isOpen, activeConversation, loadConversations, loadUnreadCount]);

  // 初始加载
  useEffect(() => {
    if (isLoggedIn) {
      loadConversations();
      loadUnreadCount();
      // 轮询更新未读数（每30秒）
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, loadConversations, loadUnreadCount]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (!isLoggedIn) return null;

  return (
    <div className="relative">
      {/* 私信图标按钮 */}
      <button
        ref={buttonRef}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="私信"
      >
        <MessageCircle className="w-5 h-5 text-[var(--color-ink)]" />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* 私信面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-[380px] max-h-[520px] bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl shadow-xl overflow-hidden z-50"
          >
            {/* 面板头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline)]">
              {activeConversation ? (
                <>
                  <button
                    onClick={backToList}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 flex-1 ml-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={activeConvInfo?.other_user_avatar || ""} />
                      <AvatarFallback className="text-xs">
                        {activeConvInfo?.other_user_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">
                      {activeConvInfo?.other_user_name}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold">私信</h3>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push("/messages");
                    }}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    查看全部
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="h-[440px]">
              {!activeConversation ? (
                /* 对话列表 */
                <ScrollArea className="h-full">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-mute)] py-12">
                      <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-sm">暂无私信对话</p>
                      <p className="text-xs mt-1">访问他人主页发起私信</p>
                    </div>
                  ) : (
                    <div>
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-card)] cursor-pointer transition-colors group"
                          onClick={() => openConversation(conv)}
                        >
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={conv.other_user_avatar || ""} />
                            <AvatarFallback className="text-sm">
                              {conv.other_user_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">
                                {conv.other_user_name}
                              </span>
                              <span className="text-[10px] text-[var(--color-mute)] shrink-0 ml-2">
                                {conv.last_message_created_at
                                  ? timeAgo(conv.last_message_created_at)
                                  : ""}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-mute)] truncate mt-0.5">
                              {conv.last_message_content || "暂无消息"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(conv.unread_count || 0) > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {(conv.unread_count || 0) > 99
                                  ? "99+"
                                  : conv.unread_count}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(conv.id);
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                              title="删除对话"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              ) : (
                /* 消息详情 */
                <div className="flex flex-col h-full">
                  {/* 消息列表 */}
                  <ScrollArea className="flex-1 px-4 py-3">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-mute)]" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-[var(--color-mute)] text-sm">
                        发送第一条消息开始对话
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => {
                          const isMine = msg.sender_id === parseInt((session?.user as any)?.id || "0");
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                            >
                              <div className={`flex items-end gap-2 max-w-[75%] ${isMine ? "flex-row-reverse" : ""}`}>
                                {!isMine && (
                                  <Avatar className="w-6 h-6 shrink-0">
                                    <AvatarImage src={msg.sender_avatar || ""} />
                                    <AvatarFallback className="text-[10px]">
                                      {msg.sender_name?.charAt(0) || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div>
                                  <div
                                    className={`px-3 py-2 rounded-2xl text-sm break-words ${
                                      isMine
                                        ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black rounded-br-md"
                                        : "bg-[var(--color-surface-card)] text-[var(--color-ink)] rounded-bl-md"
                                    }`}
                                  >
                                    {msg.message_type === "image" ? (
                                      <img
                                        src={msg.content}
                                        alt="图片消息"
                                        className="max-w-full rounded-lg"
                                      />
                                    ) : (
                                      msg.content
                                    )}
                                  </div>
                                  <p
                                    className={`text-[10px] text-[var(--color-mute)] mt-0.5 ${
                                      isMine ? "text-right" : "text-left"
                                    }`}
                                  >
                                    {timeAgo(msg.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* 输入区域 */}
                  <div className="px-3 py-2 border-t border-[var(--color-hairline)]">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={inputRef}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="输入消息..."
                        className="flex-1 h-9 text-sm rounded-full"
                        disabled={sending}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!messageInput.trim() || sending}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}