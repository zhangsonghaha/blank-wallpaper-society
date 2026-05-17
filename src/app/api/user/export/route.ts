import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/user/export - 导出当前用户的所有数据（GDPR 合规）
 * 返回 JSON 格式的用户数据，包含：个人信息、上传的图片、收藏、评论、帖子、下载历史等
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 并行查询所有用户相关数据
    const [
      users,
      images,
      favorites,
      comments,
      posts,
      postLikes,
      downloads,
      collections,
      collectionImages,
      follows,
      followers,
      apiKeys,
      notifications,
      userLevel,
      achievements,
    ] = await Promise.all([
      // 1. 用户基本信息
      query("SELECT id, username, email, display_name, bio, avatar_url, role, created_at FROM users WHERE id = ?", [userId]),

      // 2. 用户上传的图片
      query(
        "SELECT id, title, description, category, storage_key, width, height, mime_type, media_type, download_count, view_count, nsfw_score, status, created_at FROM images WHERE uploaded_by = ?",
        [userId]
      ),

      // 3. 收藏记录
      query(
        `SELECT f.id, f.image_id, f.created_at, i.title as image_title 
         FROM favorites f LEFT JOIN images i ON f.image_id = i.id 
         WHERE f.user_id = ?`,
        [userId]
      ),

      // 4. 评论
      query(
        `SELECT c.id, c.content, c.image_id, c.parent_id, c.created_at, i.title as image_title 
         FROM comments c LEFT JOIN images i ON c.image_id = i.id 
         WHERE c.user_id = ?`,
        [userId]
      ),

      // 5. 帖子
      query("SELECT id, title, content, created_at FROM posts WHERE author_id = ?", [userId]),

      // 6. 帖子点赞
      query(
        `SELECT pl.id, pl.post_id, pl.created_at, p.title as post_title 
         FROM post_likes pl LEFT JOIN posts p ON pl.post_id = p.id 
         WHERE pl.user_id = ?`,
        [userId]
      ),

      // 7. 下载历史
      query("SELECT id, image_id, ip_address, resolution, created_at FROM download_logs WHERE image_id IN (SELECT id FROM images WHERE uploaded_by = ?)", [userId]),

      // 8. 创建的收藏集
      query("SELECT id, name, description, is_public, created_at FROM collections WHERE user_id = ?", [userId]),

      // 9. 收藏集中的图片
      query(
        `SELECT ci.id, ci.collection_id, ci.image_id, ci.added_at, c.name as collection_name 
         FROM collection_images ci 
         JOIN collections c ON ci.collection_id = c.id 
         WHERE c.user_id = ?`,
        [userId]
      ),

      // 10. 关注的用户
      query(
        `SELECT uf.id, uf.following_id, uf.created_at, u.username as following_username 
         FROM user_follows uf JOIN users u ON uf.following_id = u.id 
         WHERE uf.follower_id = ?`,
        [userId]
      ),

      // 11. 被谁关注
      query(
        `SELECT uf.id, uf.follower_id, uf.created_at, u.username as follower_username 
         FROM user_follows uf JOIN users u ON uf.follower_id = u.id 
         WHERE uf.following_id = ?`,
        [userId]
      ),

      // 12. API Keys（仅前缀，不暴露hash）
      query("SELECT id, key_prefix, name, rate_limit, is_active, created_at, last_used_at, expires_at FROM api_keys WHERE user_id = ?", [userId]),

      // 13. 通知
      query("SELECT id, type, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 500", [userId]),

      // 14. 用户等级
      query("SELECT level, exp, total_exp FROM user_levels WHERE user_id = ?", [userId]),

      // 15. 成就
      query(
        `SELECT ua.id, ua.achievement_id, ua.unlocked_at, a.name, a.description 
         FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id 
         WHERE ua.user_id = ?`,
        [userId]
      ),
    ]);

    // 组装导出数据
    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: "1.0",
        notice: "此数据导出符合 GDPR 数据可携带权要求。如需删除账户，请访问设置页面。",
      },
      profile: (users as any[])[0] || null,
      images: images as any[],
      favorites: favorites as any[],
      comments: comments as any[],
      posts: posts as any[],
      post_likes: postLikes as any[],
      download_history: downloads as any[],
      collections: collections as any[],
      collection_images: collectionImages as any[],
      following: follows as any[],
      followers: followers as any[],
      api_keys: apiKeys as any[],
      notifications: notifications as any[],
      user_level: (userLevel as any[])[0] || null,
      achievements: achievements as any[],
    };

    // 返回 JSON 文件下载
    const jsonStr = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonStr, "utf-8");

    const username = (users as any[])[0]?.username || `user_${userId}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${username}_data_export_${dateStr}.json`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch (error: any) {
    console.error("用户数据导出失败:", error);
    return NextResponse.json(
      { error: error.message || "数据导出失败" },
      { status: 500 }
    );
  }
}