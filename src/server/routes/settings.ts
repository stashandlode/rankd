import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/our-company', requireAuth, async (_req: Request, res: Response) => {
  try {
    const company = await prisma.company.findFirst({
      where: { isOurCompany: true },
    });

    res.json({ data: { placeId: company?.placeId ?? null } });
  } catch (err) {
    console.error('Get our company error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/our-company', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { placeId } = req.body;

    if (!placeId) {
      res.status(400).json({ error: 'placeId required' });
      return;
    }

    const company = await prisma.company.findUnique({ where: { placeId } });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Clear any existing "our company" flag
    await prisma.company.updateMany({
      where: { isOurCompany: true },
      data: { isOurCompany: false },
    });

    // Set the new one
    await prisma.company.update({
      where: { placeId },
      data: { isOurCompany: true },
    });

    res.json({ data: { success: true } });
  } catch (err) {
    console.error('Set our company error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
