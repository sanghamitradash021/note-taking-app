import express, { type Express } from 'express';

const app: Express = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.warn(`Backend running on port ${PORT}`);
});

export { app };
