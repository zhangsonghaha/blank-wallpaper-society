import Redis from "ioredis";

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  // password: "2b6a4d28a9f4619d3d63",
  db: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export default redis;

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("Redis setCache error:", err);
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Redis delCache error:", err);
  }
}

export async function clearPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error("Redis clearPattern error:", err);
  }
}