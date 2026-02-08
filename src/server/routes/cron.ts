import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { runWeeklyRefresh } from '../scraper.js';

const router = Router();

router.post('/weekly-refresh', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const results = await runWeeklyRefresh();
    res.json({ data: { results } });
  } catch (err) {
    console.error('Weekly refresh error:', err);
    res.status(500).json({ error: 'Weekly refresh failed' });
  }
});

export default router;
