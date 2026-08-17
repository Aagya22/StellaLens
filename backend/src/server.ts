import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { env, corsOrigins, isProd } from './config/env';
import { connectDatabase, disconnectDatabase, isDatabaseReady } from './config/db';
import { ordersRouter } from './routes/orders';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { adminRouter } from './routes/admin';
import { productsRouter } from './routes/products';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'StellaLens Celestial Backend is running' });
});

app.get('/health', (_req: Request, res: Response) => {
  const dbReady = isDatabaseReady();
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/admin', adminRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();
    console.info('[db] connected');
  } catch (err) {
    console.error('[db] could not connect:', (err as Error).message);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.info(`[server] listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (!isProd) console.info(`[server] allowed origins: ${corsOrigins.join(', ')}`);
  });

  const shutdown = async (signal: string) => {
    console.info(`[server] ${signal} — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void start();
