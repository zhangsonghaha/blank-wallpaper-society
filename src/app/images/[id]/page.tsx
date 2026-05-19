import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import ImageDetailClient from "./ImageDetailClient";

// 获取图片数据的辅助函数
async function getImageData(id: string) {
  const rows = (await query(
    "SELECT i.*, u.name as uploader_name, u.avatar as uploader_avatar FROM images i LEFT JOIN users u ON i.uploaded_by = u.id WHERE i.id = ? AND i.status = 'approved'",
    [id]
  )) as any[];

  if (rows.length === 0) return null;

  const image = rows[0];

  // 获取分类和标签
  const tags = image.tags
    ? (typeof image.tags === "string"
        ? (() => { try { return JSON.parse(image.tags); } catch { return image.tags.split(",").map((t: string) => t.trim()).filter(Boolean); } })()
        : image.tags)
    : [];

  // 构建图片URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://imagegallery.app";
  const imageUrl = image.storage_key
    ? `https://qq.qinqin.asia/storage/${image.storage_key}`
    : image.url || "";

  return {
    id: image.id,
    title: image.title || "精选壁纸",
    description: image.description || "",
    imageUrl,
    thumbnailUrl: image.thumbnail_key
      ? `https://qq.qinqin.asia/storage/${image.thumbnail_key}`
      : imageUrl,
    width: image.width || 1920,
    height: image.height || 1080,
    tags,
    category: image.category || "",
    author: image.uploader_name || "ImageGallery",
    authorAvatar: image.uploader_avatar || "",
    uploadedBy: image.uploaded_by,
    dominantColor: image.dominant_color || "",
    downloadCount: image.download_count || 0,
    viewCount: image.view_count || 0,
    createdAt: image.created_at,
    mediaType: image.media_type || "image",
    baseUrl,
  };
}

// 动态生成 Metadata（SEO + OG）
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getImageData(id);

  if (!data) {
    return { title: "图片不存在" };
  }

  const tagText = data.tags.join(", ");
  const altText = `${data.title} - ${tagText}`;
  const description = data.description || `${data.title}，${data.category}分类精选壁纸，${tagText}`;

  return {
    title: data.title,
    description,
    keywords: [...data.tags, data.category, "壁纸", "高清壁纸"],
    openGraph: {
      title: data.title,
      description,
      images: [
        {
          url: data.thumbnailUrl,
          width: data.width,
          height: data.height,
          alt: altText,
        },
      ],
      type: "article",
      siteName: "ImageGallery",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description,
      images: [data.thumbnailUrl],
    },
    alternates: {
      canonical: `${data.baseUrl}/images/${id}`,
    },
  };
}

// SSR 图片详情页
export default async function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getImageData(id);

  if (!data) {
    notFound();
  }

  // JSON-LD 结构化数据
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: data.title,
    description: data.description || `${data.title} - 精选壁纸`,
    url: `${data.baseUrl}/images/${id}`,
    contentUrl: data.imageUrl,
    thumbnailUrl: data.thumbnailUrl,
    width: data.width,
    height: data.height,
    author: {
      "@type": "Person",
      name: data.author,
    },
    datePublished: data.createdAt,
    keywords: data.tags.join(", "),
    category: data.category,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ImageDetailClient imageData={data} imageId={id} />
    </>
  );
}