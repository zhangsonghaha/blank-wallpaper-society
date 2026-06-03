import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/challenges/[id]/submit - 投稿参赛
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    const challengeId = parseInt(id);

    if (isNaN(challengeId)) {
      return NextResponse.json({ error: "无效的活动ID" }, { status: 400 });
    }

    const body = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json({ error: "请选择要投稿的图片" }, { status: 400 });
    }

    // 验证活动存在且正在进行
    const challenge = await db
      .selectFrom("challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .where("status", "=", "active")
      .execute();

    if (challenge.length === 0) {
      return NextResponse.json({ error: "活动不存在或未开始" }, { status: 404 });
    }

    const now = new Date();
    if (now < new Date(challenge[0].start_time) || now > new Date(challenge[0].end_time)) {
      return NextResponse.json({ error: "活动未在进行期间" }, { status: 400 });
    }

    // 验证图片属于当前用户（允许 approved 和 pending 状态）
    const image = await db
      .selectFrom("images")
      .select(["id", "status"])
      .where("id", "=", imageId)
      .where("uploaded_by", "=", userId)
      .execute();

    if (image.length === 0) {
      return NextResponse.json({ error: "图片不存在或不属于你" }, { status: 400 });
    }

    // 投稿状态跟随图片状态：图片 pending 则投稿也 pending
    const submissionStatus = image[0].status === "approved" ? "approved" : "pending";

    // 检查投稿数量限制
    const existingSubs = await db
      .selectFrom("challenge_submissions")
      .select((eb) => [eb.fn.countAll().as("count")])
      .where("challenge_id", "=", challengeId)
      .where("user_id", "=", userId)
      .execute();

    if (Number(existingSubs[0]?.count ?? 0) >= (challenge[0].max_submissions || 3)) {
      return NextResponse.json(
        { error: `每人最多投稿${challenge[0].max_submissions || 3}次` },
        { status: 400 }
      );
    }

    // 检查是否重复投稿
    const duplicate = await db
      .selectFrom("challenge_submissions")
      .select(["id"])
      .where("challenge_id", "=", challengeId)
      .where("user_id", "=", userId)
      .where("image_id", "=", imageId)
      .execute();

    if (duplicate.length > 0) {
      return NextResponse.json({ error: "该图片已投稿" }, { status: 409 });
    }

    await db
      .insertInto("challenge_submissions")
      .values({
        challenge_id: challengeId,
        user_id: userId,
        image_id: imageId,
        status: submissionStatus,
      })
      .executeTakeFirst();

    const responseMessage = submissionStatus === "pending"
      ? "投稿成功，图片审核通过后作品将自动展示"
      : "投稿成功";

    return NextResponse.json({ message: responseMessage, status: submissionStatus }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/challenges/[id]/submit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
