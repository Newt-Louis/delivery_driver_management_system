import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

function defaultRedisUrl(): string {
  const password = process.env.REDIS_PASSWORD;
  if (password) return `redis://:${encodeURIComponent(password)}@localhost:6379`;
  return 'redis://localhost:6379';
}

function assertRedisSecurity(url: string): void {
  let hasPassword = false;
  try {
    hasPassword = Boolean(new URL(url).password);
  } catch {
    hasPassword = url.includes('@');
  }

  if (hasPassword) return;

  const message = 'REDIS_URL không có password. Redis đang chứa session/cache cấu hình nhạy cảm; hãy dùng redis://:<password>@host:6379.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(`[security] ${message}`);
}

export async function getRedis(): Promise<RedisClientType> {
  if (redisClient?.isOpen) return redisClient;
  if (connectPromise) return connectPromise;

  const url = process.env.REDIS_URL ?? defaultRedisUrl();
  assertRedisSecurity(url);
  const client = createClient({ url });
  client.on('error', (error) => {
    console.error('Redis error:', error);
  });

  connectPromise = client.connect().then(() => {
    redisClient = client as RedisClientType;
    connectPromise = null;
    return redisClient;
  }).catch((error) => {
    connectPromise = null;
    throw error;
  });

  return connectPromise;
}
