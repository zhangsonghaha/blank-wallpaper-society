import { query } from "@/lib/db";

// 嵌入式「每日壁纸」小组件页面（iframe方案）
export default async function EmbedDailyPage() {
  // 获取今日热门壁纸
  const rows = (await query(
    `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height, i.author,
            u.name as author_name
     FROM images i
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE i.status = 'approved'
     ORDER BY i.download_count DESC, i.view_count DESC
     LIMIT 1`
  )) as any[];

  if (rows.length === 0) {
    return (
      <html>
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            暂无壁纸
          </div>
        </body>
      </html>
    );
  }

  const image = rows[0];
  const siteUrl = process.env.NEXT_PUBLIC_URL || "https://bws.example.com";
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; overflow: hidden; }
          .container { position: relative; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; background: #111; }
          .wallpaper { max-width: 100%; max-height: 100%; object-fit: cover; }
          .overlay { position: absolute; top: 0; left: 0; right: 0; padding: 16px; background: linear-gradient(rgba(0,0,0,0.5), transparent); }
          .date-badge { display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); border-radius: 20px; color: #fff; font-size: 12px; letter-spacing: 0.5px; }
          .daily-label { color: #fff; font-size: 16px; font-weight: 600; margin-top: 6px; }
          .info-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); display: flex; justify-content: space-between; align-items: flex-end; }
          .info-bar a { color: #fff; text-decoration: none; font-size: 11px; opacity: 0.8; border: 1px solid rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 16px; }
          .info-bar a:hover { opacity: 1; background: rgba(255,255,255,0.1); }
          .title { color: #fff; font-size: 14px; font-weight: 500; }
          .author { color: #ccc; font-size: 11px; margin-top: 2px; }
          .brand { color: rgba(255,255,255,0.4); font-size: 9px; margin-top: 4px; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <img className="wallpaper" src={image.url} alt={image.title} loading="lazy" />
          <div className="overlay">
            <div className="date-badge">{today}</div>
            <div className="daily-label">每日壁纸</div>
          </div>
          <div className="info-bar">
            <div>
              <div className="title">{image.title}</div>
              <div className="author">by {image.author_name || image.author}</div>
              <div className="brand">Blank Wallpaper Society</div>
            </div>
            <a href={`${siteUrl}/image/${image.id}`} target="_blank" rel="noopener noreferrer">
              下载壁纸
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}