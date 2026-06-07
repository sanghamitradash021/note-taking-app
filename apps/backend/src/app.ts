import express, { type Express } from 'express';
import authRouter from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

app.use(errorHandler);

export { app };
