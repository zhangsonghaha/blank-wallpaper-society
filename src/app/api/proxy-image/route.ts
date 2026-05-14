import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, BUCKET_NAME } from "@/lib/minio";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "缺少图片URL" }, { status: 400 });
  }

  try {
    // 如果是 MinIO 公开 URL，通过 SDK 获取
    const publicUrlBase = "https://qq.qinqin.asia/storage/image-gallery/";
    if (url.startsWith(publicUrlBase)) {
      const storageKey = url.replace(publicUrlBase, "");
      console.log("[proxy-image] Fetching from MinIO:", storageKey);

      const client = getMinioClient();
      const dataStream = await client.getObject(BUCKET_NAME, storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 根据扩展名推断 content-type
      const ext = storageKey.split(".").pop()?.toLowerCase() || "jpg";
      const contentTypeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
      };
      const contentType = contentTypeMap[ext] || "image/jpeg";

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 对于其他 URL，直接转发
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取图片失败: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[proxy-image] 代理图片失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "代理图片失败" },
      { status: 500 }
    );
  }
}