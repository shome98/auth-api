import app from './server';
import { env } from './config/env';
import { client } from './db';
import { sessionService } from './services/session.service';
import { guestService } from './services/guest.service';
import { authService } from './services/auth.service';
import { loginActivityService } from './services/login-activity.service';
import logger from './utils/logger';

// 🚀 Server Entry Point

const server = app.listen(env.PORT, () => {
  logger.info('🔐 Personal Auth API');
  logger.info(`📡 Port: ${String(env.PORT).padEnd(36)}`);
  logger.info(`🌍 Environment: ${env.NODE_ENV.padEnd(36)}`);
  logger.info(`🔗 URL: ${env.APP_URL.padEnd(36)}`);
  logger.info(`💚 Health: ${(env.APP_URL + '/healthz').padEnd(36)}`);
  logger.info(`🚀 Ready: ${(env.APP_URL + '/readyz').padEnd(36)}`);
});

// Periodic cleanup (every hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const cleanupTimer = setInterval(async () => {
  try {
    await sessionService.cleanupExpired();
    await guestService.cleanupExpired();
    await authService.cleanupExpiredTokens();
    await loginActivityService.cleanupOlderThan(90);
    console.log(
      '🧹 Periodic cleanup: expired sessions, guests, tokens & old activity removed.',
    );
  } catch (err) {
    console.error('⚠️  Periodic cleanup error:', err);
  }
}, CLEANUP_INTERVAL);

//  Graceful shutdown
function gracefulShutdown(signal: string) {
  logger.info(`⚡${signal} received — shutting down gracefully...`);
  clearInterval(cleanupTimer);
  server.close(async () => {
    try {
      await client.end();
      logger.info('🗄️  Database connection closed.');
    } catch (err) {
      logger.error('⚠️  Error closing database connection:', err);
    }
    logger.info('👋 Server closed. Goodbye!');
    process.exit(0);
  });

  // Force-kill after 10s
  setTimeout(() => {
    logger.error('💀 Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

export default app;
