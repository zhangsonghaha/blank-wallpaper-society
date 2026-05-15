import { NextResponse } from "next/server";
import { getRecentDailyWallpapers } from "@/lib/daily-wallpaper";

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://imagegallery.app";
const SITE_TITLE = "ImageGallery 每日壁纸";
const SITE_DESCRIPTION = "每天精选一张高清壁纸，为你带来视觉灵感";

// GET /api/daily-wallpaper/rss - RSS 订阅每日壁纸
export async function GET() {
  try {
    const wallpapers = await getRecentDailyWallpapers(30);

    const items = wallpapers
      .map((wp) => {
        const pick = wp.pick;
        if (!pick) return "";

        const link = `${SITE_URL}/?lightbox=${pick.id}`;
        const imageUrl = pick.url || pick.thumbnail_url || "";
        const description = pick.description || pick.title || "每日精选壁纸";

        return `
    <item>
      <title>${escapeXml(wp.theme)} - ${escapeXml(pick.title || "每日壁纸")} (${wp.date})</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" length="0"/>
      <category>${escapeXml(wp.theme)}</category>
      <pubDate>${new Date(wp.date).toUTCString()}</pubDate>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
    </item>`;
      })
      .join("");

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(`${SITE_URL}/api/daily-wallpaper/rss`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>ImageGallery Daily Wallpaper RSS</generator>${items}
  </channel>
</rss>`;

    return new NextResponse(rssXml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("GET /api/daily-wallpaper/rss error:", error);
    return NextResponse.json(
      { error: error.message || "生成 RSS 失败" },
      { status: 500 }
    );
  }
}

/** XML 特殊字符转义 */
function escapeXml(str: string): string {
  const map: Record<string, string> = {
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "\u0026apos;",
  };
  return str.replace(/[&<>"']/g, (ch) => map[ch] || ch);
}