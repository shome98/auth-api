import Redis from 'ioredis';
import { env } from '../config/env';

/*
 🔴 Redis Client — Singleton
 Used for:
   • refresh token storage  (refresh:{hash})
   • JWT blocklist          (blocked:{jti})
   • optional session cache (session_cache:{hash})
*/

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // Exponential backoff capped at 5s
        return Math.min(times * 200, 5000);
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ [Redis] Connected');
    });
    redisClient.on('error', (err) => {
      console.error('❌ [Redis] Error:', err.message);
    });
    redisClient.on('close', () => {
      console.warn('⚠️  [Redis] Connection closed');
    });
  }

  return redisClient;
}

export const redis = getRedisClient();
