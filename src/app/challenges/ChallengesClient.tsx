"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Calendar, Users, Vote, ArrowLeft, Plus, Heart,
  Loader2, ImagePlus, Crown, Clock, CheckCircle, Upload, X
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { withCsrfHeader } from "@/lib/csrf-client";
import { Label } from "@/components/ui/label";

interface Challenge {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  start_time: string;
  end_time: string;
  max_submissions: number;
  votes_per_day: number;
  prize_exp: number;
  prize_description: string;
  submission_count: number;
  vote_count: number;
  creator_name: string;
  created_at: string;
}

interface Submission {
  id: number;
  user_id: number;
  image_id: number;
  user_name: string;
  user_avatar: string;
  title: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  vote_count: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-600", icon: Clock },
  active: { label: "进行中", color: "bg-green-100 text-green-700", icon: CheckCircle },
  ended: { label: "已结束", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  settled: { label: "已结算", color: "bg-blue-100 text-blue-700", icon: Crown },
};

export default function ChallengesClient() {
  const { data: session, status: authStatus } = useSession();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");

  // 详情页状态
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<Submission[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"submissions" | "leaderboard">("submissions");
  const [canSubmit, setCanSubmit] = useState(false);
  const [canVote, setCanVote] = useState(false);
  const [userSubmissionCount, setUserSubmissionCount] = useState(0);
  const [userVotesToday, setUserVotesToday] = useState(0);

  // 投稿对话框
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitImageId, setSubmitImageId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"select" | "upload">("select");

  // 上传相关状态
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 我的图片列表（用于投稿选择）
  const [myImages, setMyImages] = useState<any[]>([]);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges?status=${activeTab === "active" ? "active" : "all"}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.data || []);
      }
    } catch (err) {
      console.error("获取挑战赛失败:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const fetchDetail = useCallback(async (challengeId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/challenges/${challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.data?.submissions || []);
        const userSubCount = data.data?.userSubmissionCount || 0;
        const maxSubs = parseInt(data.data?.challenge?.max_submissions) || 3;
        // 前端重新计算canSubmit，双重保险
        const newCanSubmit = userSubCount < maxSubs;
        setCanSubmit(newCanSubmit);
        setCanVote(data.data?.canVote || false);
        setUserSubmissionCount(userSubCount);
        setUserVotesToday(data.data?.userVotesToday || 0);
      }
    } catch (err) {
      console.error("获取详情失败:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (challengeId: number) => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}?action=leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.data?.leaderboard || []);
      }
    } catch (err) {
      console.error("获取排行榜失败:", err);
    }
  }, []);

  const fetchMyImages = useCallback(async (): Promise<boolean> => {
    if (authStatus !== "authenticated") return false;
    try {
      // 获取已审核通过和待审核的图片，用于投稿选择
      const [approvedRes, pendingRes] = await Promise.all([
        fetch("/api/user/uploads?status=approved&limit=50"),
        fetch("/api/user/uploads?status=pending&limit=10"),
      ]);
      const approvedData = approvedRes.ok ? await approvedRes.json() : { data: [] };
      const pendingData = pendingRes.ok ? await pendingRes.json() : { data: [] };
      const allImages = [...(approvedData.data || []), ...(pendingData.data || [])];
      setMyImages(allImages);
      return allImages.length > 0;
    } catch (err) {
      console.error("获取我的图片失败:", err);
      return false;
    }
  }, [authStatus]);

  const openDetail = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setDetailTab("submissions");
    fetchDetail(challenge.id);
  };

  const handleVote = async (submissionId: number) => {
    if (!selectedChallenge || authStatus !== "authenticated") {
      toast.error("请先登录");
      return;
    }
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/challenges/${selectedChallenge.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("投票成功");
        setUserVotesToday((v) => v + 1);
        setCanVote(userVotesToday + 1 < (selectedChallenge.votes_per_day || 5));
        fetchDetail(selectedChallenge.id);
      } else {
        toast.error(data.error || "投票失败");
      }
    } catch {
      toast.error("投票失败");
    }
  };

  const handleSubmit = async () => {
    if (!selectedChallenge || !submitImageId) {
      toast.error("请选择要投稿的图片");
      return;
    }
    setSubmitting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/challenges/${selectedChallenge.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ imageId: parseInt(submitImageId) }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "pending") {
          toast.success("投稿成功，图片审核通过后作品将自动展示");
        } else {
          toast.success("投稿成功");
        }
        setSubmitOpen(false);
        setSubmitImageId("");
        setUserSubmissionCount((v) => v + 1);
        fetchDetail(selectedChallenge.id);
      } else {
        toast.error(data.error || "投稿失败");
      }
    } catch {
      toast.error("投稿失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitDialog = () => {
    fetchMyImages().then((hasImages) => {
      // 如果没有已审核图片，默认打开上传模式
      setSubmitMode(hasImages ? "select" : "upload");
    });
    setSubmitImageId("");
    setUploadFile(null);
    setUploadPreview("");
    setUploadTitle("");
    setUploadCategory("");
    setSubmitOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("仅支持 JPG/PNG/WebP 格式");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
      return;
    }
    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAndSubmit = async () => {
    if (!uploadFile || !selectedChallenge) return;
    setUploading(true);
    try {
      // 第一步：上传图片
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile.name);
      if (uploadCategory) formData.append("category", uploadCategory);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast.error(uploadData.error || "上传失败");
        return;
      }

      // 第二步：投稿参赛
      const newImageId = uploadData.id;
      const csrfHeaders = await withCsrfHeader();
      const submitRes = await fetch(`/api/challenges/${selectedChallenge.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ imageId: newImageId }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        toast.error(submitData.error || "投稿失败");
        return;
      }

      if (submitData.status === "pending") {
        toast.success("投稿成功，图片审核通过后作品将自动展示");
      } else {
        toast.success("投稿成功");
      }
      setSubmitOpen(false);
      setUserSubmissionCount((v) => v + 1);
      fetchDetail(selectedChallenge.id);
    } catch {
      toast.error("操作失败");
    } finally {
      setUploading(false);
    }
  };

  // === 列表视图 ===
  if (!selectedChallenge) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-500" /> 挑战赛
            </h1>
            <p className="text-sm text-[var(--color-mute)] mt-1">
              参加主题挑战赛，展示创作才华，赢取经验值奖励
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 mb-6">
          {(["active", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                activeTab === tab
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
              }`}
            >
              {tab === "active" ? "进行中" : "全部"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
          </div>
        ) : challenges.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-[var(--color-mute)] text-lg">暂无挑战赛活动</p>
              <p className="text-sm text-[var(--color-mute)] mt-2">新的挑战即将到来，敬请期待！</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((c, idx) => {
              const sc = statusConfig[c.status] || statusConfig.draft;
              const StatusIcon = sc.icon;
              const isActive = c.status === "active";
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                >
                  <Card
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      isActive ? "ring-2 ring-green-400/50" : ""
                    }`}
                    onClick={() => openDetail(c)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-[var(--color-ink)] text-lg leading-tight flex-1">
                          {c.title}
                        </h3>
                        <Badge className={`${sc.color} ml-2 shrink-0`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {sc.label}
                        </Badge>
                      </div>

                      {c.description && (
                        <p className="text-sm text-[var(--color-mute)] line-clamp-2 mb-3">
                          {c.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-[var(--color-mute)] mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(c.start_time).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                          ~
                          {new Date(c.end_time).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                        </span>
                        {c.category && (
                          <Badge variant="secondary" className="text-xs">{c.category}</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-4 text-xs text-[var(--color-mute)]">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {c.submission_count} 投稿
                          </span>
                          <span className="flex items-center gap-1">
                            <Vote className="w-3.5 h-3.5" /> {c.vote_count} 票
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
                              <ImagePlus className="w-3 h-3" /> 点击投稿
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-sm font-semibold text-yellow-600">
                            <Crown className="w-4 h-4" /> +{c.prize_exp} EXP
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === 详情视图 ===
  const c = selectedChallenge;
  const sc = statusConfig[c.status] || statusConfig.draft;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
      {/* 返回按钮 */}
      <button
        onClick={() => setSelectedChallenge(null)}
        className="flex items-center gap-1 text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> 返回列表
      </button>

      {/* 活动信息头部 */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-[var(--color-ink)]">{c.title}</h1>
              <Badge className={sc.color}>{sc.label}</Badge>
            </div>
            {c.description && (
              <p className="text-[var(--color-mute)] mb-3">{c.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-mute)]">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(c.start_time).toLocaleDateString("zh-CN")} ~ {new Date(c.end_time).toLocaleDateString("zh-CN")}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" /> {c.submission_count} 投稿
              </span>
              <span className="flex items-center gap-1">
                <Vote className="w-4 h-4" /> {c.vote_count} 票
              </span>
              <span className="flex items-center gap-1 text-yellow-600 font-medium">
                <Crown className="w-4 h-4" /> 奖品 +{c.prize_exp} EXP
              </span>
            </div>
          </div>
        </div>

        {/* 投稿操作栏 */}
        <div className="mt-4 p-4 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm text-[var(--color-mute)]">
            {c.status === "active" ? (
              authStatus === "authenticated" ? (
                <span>投稿: {userSubmissionCount}/{c.max_submissions || 3} | 今日投票: {userVotesToday}/{c.votes_per_day || 5}</span>
              ) : (
                <span>登录后即可投稿参赛，赢取 +{c.prize_exp} EXP</span>
              )
            ) : (
              <span>
                {c.status === "draft" ? "活动尚未开始，敬请期待" : c.status === "ended" ? "活动已结束，感谢参与" : c.status === "settled" ? "活动已结算" : "暂不可投稿"}
              </span>
            )}
          </div>
          {c.status === "active" ? (
            authStatus === "authenticated" ? (
              <Button onClick={openSubmitDialog} disabled={userSubmissionCount >= (c.max_submissions || 3)}>
                <ImagePlus className="w-4 h-4 mr-1" />
                {userSubmissionCount < (c.max_submissions || 3) ? "投稿参赛" : `已投${userSubmissionCount}稿`}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const signInUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
                  window.location.href = signInUrl;
                }}
                variant="outline"
              >
                <ImagePlus className="w-4 h-4 mr-1" /> 登录后投稿
              </Button>
            )
          ) : (
            <Button disabled variant="outline">
              <ImagePlus className="w-4 h-4 mr-1" />
              {c.status === "draft" ? "未开始" : c.status === "ended" ? "已结束" : c.status === "settled" ? "已结算" : "不可投稿"}
            </Button>
          )}
        </div>
      </div>

      {/* 详情 Tab 切换 */}
      <div className="flex gap-2 mb-6">
        {(["submissions", "leaderboard"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setDetailTab(tab);
              if (tab === "leaderboard") fetchLeaderboard(c.id);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              detailTab === tab
                ? "bg-[var(--color-ink)] text-white"
                : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
            }`}
          >
            {tab === "submissions" ? (
              <React.Fragment><ImagePlus className="w-4 h-4" /> 参赛作品</React.Fragment>
            ) : (
              <React.Fragment><Crown className="w-4 h-4" /> 排行榜</React.Fragment>
            )}
          </button>
        ))}
      </div>

      {detailLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
        </div>
      ) : detailTab === "submissions" ? (
        /* 参赛作品网格 */
        submissions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-[var(--color-mute)]">暂无参赛作品</p>
              {canSubmit && (
                <Button className="mt-4" onClick={openSubmitDialog}>
                  <ImagePlus className="w-4 h-4 mr-1" /> 成为第一个投稿者
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {submissions.map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
              >
                <a
                  href={sub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-inside-avoid rounded-xl overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-md transition-shadow group block"
                >
                  <div className="relative">
                    <img
                      src={sub.thumbnail_url || sub.url}
                      alt={sub.title}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    {/* 投票按钮 */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(sub.id);
                        }}
                        disabled={!canVote || authStatus !== "authenticated"}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/90 rounded-full text-xs font-semibold text-red-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Heart className="w-3.5 h-3.5" /> 投票
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[var(--color-ink)] truncate">{sub.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[var(--color-mute)]">by {sub.user_name}</span>
                      <span className="text-xs text-[var(--color-mute)] flex items-center gap-0.5">
                        <Heart className="w-3 h-3" /> {sub.vote_count}
                      </span>
                    </div>
                  </div>
                </a>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        /* 排行榜 */
        leaderboard.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Crown className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-[var(--color-mute)]">暂无排行数据</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
              >
                <a
                  href={sub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block ${idx < 3 ? "ring-2 ring-yellow-400/30" : ""} cursor-pointer hover:shadow-md transition-shadow`}
                >
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      idx === 0 ? "bg-yellow-400 text-yellow-900" :
                      idx === 1 ? "bg-gray-300 text-gray-700" :
                      idx === 2 ? "bg-amber-600 text-white" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <img
                      src={sub.thumbnail_url || sub.url}
                      alt={sub.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-ink)] truncate">{sub.title}</p>
                      <p className="text-xs text-[var(--color-mute)]">by {sub.user_name}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-red-500 shrink-0">
                      <Heart className="w-4 h-4" /> {sub.vote_count}
                    </div>
                  </CardContent>
                </a>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* 投稿对话框 */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>投稿参赛 — {c.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 模式切换 */}
            <div className="flex gap-2 p-1 bg-[var(--color-surface-card)] rounded-lg">
              <button
                onClick={() => setSubmitMode("select")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  submitMode === "select"
                    ? "bg-[var(--color-ink)] text-white shadow-sm"
                    : "text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
                }`}
              >
                <ImagePlus className="w-4 h-4" /> 选择已有作品
              </button>
              <button
                onClick={() => setSubmitMode("upload")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  submitMode === "upload"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-green-600 hover:bg-green-50"
                }`}
              >
                <Upload className="w-4 h-4" /> 上传新作品
              </button>
            </div>

            <p className="text-xs text-[var(--color-mute)]">
              已投 {userSubmissionCount}/{c.max_submissions || 3} 稿
            </p>

            {submitMode === "select" ? (
              <React.Fragment>
                {myImages.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-[var(--color-mute)] text-sm">
                      <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>你还没有已审核通过的图片</p>
                      <p className="mt-1">请切换到"上传新作品"上传图片</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {myImages.map((img: any) => (
                      <button
                        key={img.id}
                        onClick={() => setSubmitImageId(String(img.id))}
                        className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                          submitImageId === String(img.id)
                            ? "border-[var(--color-ink)]"
                            : "border-transparent hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={img.thumbnail_url || img.url}
                          alt={img.title}
                          className="w-full h-20 object-cover"
                        />
                        {img.status === "pending" && (
                          <div className="absolute top-0 left-0 right-0 bg-yellow-500/80 text-white text-[10px] text-center py-0.5">待审核</div>
                        )}
                        {submitImageId === String(img.id) && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <Label>或输入图片ID</Label>
                  <Input
                    value={submitImageId}
                    onChange={(e) => setSubmitImageId(e.target.value)}
                    placeholder="输入图片ID"
                  />
                </div>
              </React.Fragment>
            ) : (
              /* 上传新作品 */
              <div className="space-y-3">
                {!uploadFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg py-8 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] transition-colors"
                  >
                    <Upload className="w-8 h-8 text-[var(--color-mute)] mb-2" />
                    <p className="text-sm text-[var(--color-mute)]">点击选择图片文件</p>
                    <p className="text-xs text-[var(--color-mute)] mt-1">JPG/PNG/WebP，最低 1920x1080，最大 10MB</p>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={uploadPreview}
                      alt="预览"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreview("");
                        setUploadTitle("");
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadFile && (
                  <div className="space-y-2">
                    <div>
                      <Label>作品标题</Label>
                      <Input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="输入作品标题"
                      />
                    </div>
                    <div>
                      <Label>分类</Label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">不选择</option>
                        <option value="nature">自然风光</option>
                        <option value="city">城市建筑</option>
                        <option value="portrait">人像摄影</option>
                        <option value="food">美食</option>
                        <option value="travel">旅行</option>
                        <option value="art">艺术</option>
                        <option value="animals">动物</option>
                        <option value="minimal">极简</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>取消</Button>
            {submitMode === "select" ? (
              <Button onClick={handleSubmit} disabled={!submitImageId || submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                确认投稿
              </Button>
            ) : (
              <Button onClick={handleUploadAndSubmit} disabled={!uploadFile || uploading}>
                {uploading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                上传并投稿
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}