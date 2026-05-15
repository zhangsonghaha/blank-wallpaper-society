import { MetadataRoute } from "next";
import { query } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://imagegallery.app";

  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/collections`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/upload`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/api-docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // 动态图片页面
  try {
    const images = (await query(
      "SELECT id, updated_at FROM images WHERE status = 'approved' ORDER BY updated_at DESC LIMIT 500"
    )) as any[];

    const imagePages: MetadataRoute.Sitemap = images.map((img) => ({
      url: `${baseUrl}/?pin=${img.id}`,
      lastModified: new Date(img.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    // 动态合集页面
    const collections = (await query(
      "SELECT id, updated_at FROM collections WHERE is_public = 1 ORDER BY updated_at DESC LIMIT 100"
    )) as any[];

    const collectionPages: MetadataRoute.Sitemap = collections.map((col) => ({
      url: `${baseUrl}/collections/${col.id}`,
      lastModified: new Date(col.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...imagePages, ...collectionPages];
  } catch {
    return staticPages;
  }
}