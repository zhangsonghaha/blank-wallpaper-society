import { Client } from "minio";

export const MINIO_CONFIG = {
  endPoint: "82.157.176.188",
  port: 9000,
  useSSL: false,
  accessKey: "rustfsadmin",
  secretKey: "rustfsadmin",
};

export const BUCKET_NAME = "image-gallery";
export const PUBLIC_URL_BASE = "https://qq.qinqin.asia/storage";

let minioClient: Client | null = null;

export function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client(MINIO_CONFIG);
  }
  return minioClient;
}

/**
 * 上传文件到 MinIO
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<{ storageKey: string; url: string }> {
  const client = getMinioClient();
  const timestamp = Date.now();
  const ext = filename.split(".").pop() || "jpg";
  const safeName = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.-]/g, "_");
  const storageKey = `images/${timestamp}_${safeName}`;

  await client.putObject(BUCKET_NAME, storageKey, file, file.length, {
    "Content-Type": mimeType,
  });

  const url = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;
  return { storageKey, url };
}

/**
 * 删除文件
 */
export async function deleteFile(storageKey: string) {
  const client = getMinioClient();
  await client.removeObject(BUCKET_NAME, storageKey);
}

/**
 * 获取文件公开URL
 */
export function getPublicUrl(storageKey: string): string {
  return `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;
}