import { db } from "@/lib/db";

// 嵌入式壁纸展示页面（iframe方案）
export default async function EmbedWallpaperPage({
  params,
}: {
  params: Promise<{ imageId: string }>;
}) {
  const { imageId } = await params;
  const id = parseInt(imageId);

  if (isNaN(id)) {
    return (
      <html>
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            无效的图片ID
          </div>
        </body>
      </html>
    );
  }

  const image = await db
    .selectFrom("images as i")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url",
      "i.width", "i.height", "i.author",
      "u.name as author_name",
    ])
    .where("i.id", "=", id)
    .where("i.status", "=", "approved")
    .executeTakeFirst();

  if (!image) {
    return (
      <html>
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            图片不存在
          </div>
        </body>
      </html>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_URL || "https://bws.example.com";

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; overflow: hidden; }
          .container { position: relative; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; background: #111; }
          .wallpaper { max-width: 100%; max-height: 100%; object-fit: contain; }
          .info-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 16px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); display: flex; justify-content: space-between; align-items: center; }
          .info-bar a { color: #fff; text-decoration: none; font-size: 12px; opacity: 0.8; }
          .info-bar a:hover { opacity: 1; }
          .title { color: #fff; font-size: 14px; font-weight: 500; }
          .author { color: #ccc; font-size: 11px; margin-top: 2px; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <img className="wallpaper" src={image.url} alt={image.title} loading="lazy" />
          <div className="info-bar">
            <div>
              <div className="title">{image.title}</div>
              <div className="author">by {image.author_name || image.author}</div>
            </div>
            <a href={`${siteUrl}/image/${image.id}`} target="_blank" rel="noopener noreferrer">
              在 BWS 查看 →
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}