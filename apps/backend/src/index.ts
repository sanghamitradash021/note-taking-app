import { app } from './app.js';

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.warn(`Backend running on port ${PORT}`);
});

export { app };
