"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  Trash2,
  Loader2,
  ArrowLeft,
  ChevronLeft,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

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

export default function MessagesClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [activeConvInfo, setActiveConvInfo] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isLoggedIn = status === "authenticated";
  const userId = parseInt((session?.user as any)?.id || "0");

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
    } finally {
      setConvLoading(false);
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
      }
    } catch (err) {
      console.error("加载消息失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
        loadConversations();
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        const errData = await res.json();
        console.error("发送失败:", errData.error);
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
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  // 从 URL 参数中获取目标用户，自动创建对话
  useEffect(() => {
    if (!isLoggedIn) return;
    const targetUserId = searchParams.get("to");
    if (targetUserId) {
      const createConversation = async () => {
        try {
          const res = await fetch("/api/messages/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: parseInt(targetUserId) }),
          });
          if (res.ok) {
            const data = await res.json();
            const convId = data.conversationId;
            // 加载对话列表后打开此对话
            loadConversations();
            const convRes = await fetch("/api/messages/conversations");
            if (convRes.ok) {
              const convData = await convRes.json();
              const conv = (convData.data || []).find(
                (c: Conversation) => c.id === convId
              );
              if (conv) {
                openConversation(conv);
              } else {
                setActiveConversation(convId);
                loadMessages(convId);
              }
            }
          }
        } catch (err) {
          console.error("创建对话失败:", err);
        }
      };
      createConversation();
    } else {
      loadConversations();
    }
  }, [isLoggedIn, searchParams]);

  // SSE 实时推送
  useEffect(() => {
    if (!isLoggedIn) return;

    const es = new EventSource("/api/messages/stream");
    eventSourceRef.current = es;

    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message" && data.message) {
          const msg = data.message as Message;
          if (activeConversation === msg.conversation_id) {
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
          loadConversations();
        }
      } catch {}
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isLoggedIn, activeConversation, loadConversations]);

  // 自动滚动
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-[var(--color-mute)] mb-4 mx-auto opacity-40" />
          <h2 className="text-lg font-semibold mb-2">请先登录</h2>
          <p className="text-[var(--color-mute)] mb-4">登录后即可使用私信功能</p>
          <Link
            href="/login"
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-full text-sm hover:opacity-90"
          >
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-soft)]">
      <div className="max-w-4xl mx-auto pt-6 pb-20 px-4">
        {/* 页面头部 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">私信</h1>
          <div className="text-sm text-[var(--color-mute)]">
            {conversations.length > 0 && `${conversations.length} 个对话`}
          </div>
        </div>

        {/* 主体布局：左侧对话列表 + 右侧聊天窗口 */}
        <div className="flex gap-4 h-[calc(100vh-140px)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
          {/* 左侧：对话列表 */}
          <div
            className={`w-80 shrink-0 border-r border-[var(--color-hairline)] ${
              activeConversation ? "hidden md:block" : ""
            }`}
          >
            <ScrollArea className="h-full">
              {convLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-mute)]" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[var(--color-mute)]">
                  <MessageCircle className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">暂无对话</p>
                  <p className="text-xs mt-1">访问他人主页可发起私信</p>
                </div>
              ) : (
                <div>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group ${
                        activeConversation === conv.id
                          ? "bg-[var(--color-surface-card)]"
                          : "hover:bg-[var(--color-surface-card)]"
                      }`}
                      onClick={() => openConversation(conv)}
                    >
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarImage src={conv.other_user_avatar || ""} />
                        <AvatarFallback className="text-sm font-medium">
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
                      <div className="flex items-center gap-1 shrink-0">
                        {(conv.unread_count || 0) > 0 && (
                          <span className="min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
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
                          className="w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                          title="删除对话"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 右侧：聊天窗口 */}
          <div
            className={`flex-1 flex flex-col ${
              !activeConversation ? "hidden md:flex" : ""
            }`}
          >
            {!activeConversation ? (
              <div className="flex items-center justify-center h-full text-[var(--color-mute)]">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mb-4 mx-auto opacity-30" />
                  <p className="text-lg">选择一个对话开始聊天</p>
                </div>
              </div>
            ) : (
              <>
                {/* 聊天头部 */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-hairline)]">
                  <button
                    onClick={() => {
                      setActiveConversation(null);
                      setActiveConvInfo(null);
                      setMessages([]);
                    }}
                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={activeConvInfo?.other_user_avatar || ""} />
                    <AvatarFallback>
                      {activeConvInfo?.other_user_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-semibold">
                      {activeConvInfo?.other_user_name || "用户"}
                    </span>
                  </div>
                </div>

                {/* 消息列表 */}
                <ScrollArea className="flex-1 px-4 py-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-mute)] text-sm">
                      发送第一条消息开始对话
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const isMine = msg.sender_id === userId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex items-end gap-2 max-w-[70%] ${
                                isMine ? "flex-row-reverse" : ""
                              }`}
                            >
                              {!isMine && (
                                <Avatar className="w-8 h-8 shrink-0">
                                  <AvatarImage src={msg.sender_avatar || ""} />
                                  <AvatarFallback className="text-xs">
                                    {msg.sender_name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div>
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
                                    isMine
                                      ? "bg-[var(--color-primary)] text-white rounded-br-md"
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
                                  className={`text-xs text-[var(--color-mute)] mt-1 ${
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
                <div className="px-4 py-3 border-t border-[var(--color-hairline)]">
                  <div className="flex items-center gap-3">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="输入消息..."
                      className="flex-1 h-11 text-sm rounded-full"
                      disabled={sending}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sending}
                      className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}