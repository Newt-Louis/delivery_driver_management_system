import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (redisClient?.isOpen) return redisClient;
  if (connectPromise) return connectPromise;

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
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
