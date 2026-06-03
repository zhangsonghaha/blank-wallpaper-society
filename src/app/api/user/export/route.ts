import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

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

    const userId = Number((session.user as any).id);

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
      // 1. 用户基本信息 (raw SQL: uses columns not in DB types)
      sql<any>`
        SELECT id, name, email, bio, avatar, role, created_at 
        FROM users WHERE id = ${userId}
      `.execute(db).then(r => r.rows),

      // 2. 用户上传的图片
      db
        .selectFrom("images")
        .select([
          "id",
          "title",
          "description",
          "category",
          "storage_key",
          "width",
          "height",
          "mime_type",
          "media_type",
          "download_count",
          "view_count",
          "nsfw_score",
          "status",
          "created_at",
        ])
        .where("uploaded_by", "=", userId)
        .execute(),

      // 3. 收藏记录
      db
        .selectFrom("favorites as f")
        .leftJoin("images as i", "i.id", "f.image_id")
        .select([
          "f.id",
          "f.image_id",
          "f.created_at",
          "i.title as image_title",
        ])
        .where("f.user_id", "=", userId)
        .execute(),

      // 4. 评论
      db
        .selectFrom("comments as c")
        .leftJoin("images as i", "i.id", "c.image_id")
        .select([
          "c.id",
          "c.content",
          "c.image_id",
          "c.parent_id",
          "c.created_at",
          "i.title as image_title",
        ])
        .where("c.user_id", "=", userId)
        .execute(),

      // 5. 帖子
      db
        .selectFrom("posts")
        .select(["id", "content", "created_at"])
        .where("user_id", "=", userId)
        .execute(),

      // 6. 帖子点赞
      db
        .selectFrom("post_likes as pl")
        .leftJoin("posts as p", "p.id", "pl.post_id")
        .select([
          "pl.id",
          "pl.post_id",
          "pl.created_at",
          "p.content as post_content",
        ])
        .where("pl.user_id", "=", userId)
        .execute(),

      // 7. 下载历史 (images uploaded by this user)
      db
        .selectFrom("download_logs")
        .select([
          "id",
          "image_id",
          "ip_address",
          "resolution",
          "created_at",
        ])
        .where(
          "image_id",
          "in",
          db.selectFrom("images").select("id").where("uploaded_by", "=", userId)
        )
        .execute(),

      // 8. 创建的收藏集
      db
        .selectFrom("collections")
        .select([
          "id",
          "title as name",
          "description",
          "is_public",
          "created_at",
        ])
        .where("user_id", "=", userId)
        .execute(),

      // 9. 收藏集中的图片
      db
        .selectFrom("collection_images as ci")
        .innerJoin("collections as c", "c.id", "ci.collection_id")
        .select([
          "ci.id",
          "ci.collection_id",
          "ci.image_id",
          "ci.added_at",
          "c.title as collection_name",
        ])
        .where("c.user_id", "=", userId)
        .execute(),

      // 10. 关注的用户
      db
        .selectFrom("user_follows as uf")
        .innerJoin("users as u", "u.id", "uf.following_id")
        .select([
          "uf.id",
          "uf.following_id",
          "uf.created_at",
          "u.name as following_username",
        ])
        .where("uf.follower_id", "=", userId)
        .execute(),

      // 11. 被谁关注
      db
        .selectFrom("user_follows as uf")
        .innerJoin("users as u", "u.id", "uf.follower_id")
        .select([
          "uf.id",
          "uf.follower_id",
          "uf.created_at",
          "u.name as follower_username",
        ])
        .where("uf.following_id", "=", userId)
        .execute(),

      // 12. API Keys（仅前缀，不暴露hash）
      db
        .selectFrom("api_keys")
        .select([
          "id",
          "key_prefix",
          "name",
          "rate_limit",
          "is_active",
          "created_at",
          "last_used_at",
          "expires_at",
        ])
        .where("user_id", "=", userId)
        .execute(),

      // 13. 通知
      db
        .selectFrom("notifications")
        .select(["id", "type", "title", "content as message", "is_read", "created_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(500)
        .execute(),

      // 14. 用户等级
      db
        .selectFrom("user_levels")
        .select(["level", "exp"])
        .where("user_id", "=", userId)
        .execute(),

      // 15. 成就
      db
        .selectFrom("user_achievements as ua")
        .innerJoin("achievements as a", "a.id", "ua.achievement_id")
        .select([
          "ua.id",
          "ua.achievement_id",
          "ua.unlocked_at",
          "a.name",
          "a.description",
        ])
        .where("ua.user_id", "=", userId)
        .execute(),
    ]);

    // 组装导出数据
    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: "1.0",
        notice:
          "此数据导出符合 GDPR 数据可携带权要求。如需删除账户，请访问设置页面。",
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

    const username =
      (users as any[])[0]?.name || `user_${userId}`;
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
