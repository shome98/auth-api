import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { env, getClientUrls } from './config/env';
import { globalLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import guestRoutes from './routes/guest.routes';
import adminRoutes from './routes/admin.routes';
import logger from './utils/logger';

// 🚀 Express Application Setup

const app = express();

//  Trust first proxy (Nginx, ALB, etc.)
// Must be set BEFORE any middleware that reads req.ip
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        userId: (req as any).auth?.userId,
        apiId: (req as any).params?.apiId,
      },
    );
  });
  next();
});
//  Security
app.use(helmet());

// Support either a single redirect URL or a dedicated comma-separated allowlist.
const allowedOrigins = getClientUrls();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

//  Body parsing
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//  Request ID (correlation ID for logging)
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9\-_]{1,128}$/;
app.use((req, res, next) => {
  const clientId = req.headers['x-request-id'] as string | undefined;
  const requestId =
    clientId && REQUEST_ID_PATTERN.test(clientId)
      ? clientId
      : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  next();
});

//  Rate limiting
app.use(globalLimiter);

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "😊 Welcome, let's sign in!",
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
//  Health check
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'Ok',
    message: '✅ Healthy',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});
app.get('/readyz', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'Ok',
    message: '🚀 Ready',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

//  API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/admin', adminRoutes);

//  404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: '🔍 Route not found.',
    data: null,
    timestamp: new Date().toISOString(),
  });
});

//  Global error handler (must be last)
app.use(errorHandler);

export default app;
