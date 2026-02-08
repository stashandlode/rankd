import express from 'express';
import cookieSession from 'cookie-session';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import companyRoutes from './routes/companies.js';
import settingsRoutes from './routes/settings.js';
import reviewRoutes from './routes/reviews.js';
import groupRoutes from './routes/groups.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(
  cookieSession({
    name: 'rankd_session',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/groups', groupRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.join(__dirname, '../client');
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
