import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.companyGroup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        companyIds: g.companyIds ? JSON.parse(g.companyIds) : [],
        createdAt: g.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, companyIds } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Group name required' });
      return;
    }

    const group = await prisma.companyGroup.create({
      data: {
        name,
        companyIds: JSON.stringify(companyIds || []),
      },
    });

    res.status(201).json({
      data: {
        id: group.id,
        name: group.name,
        companyIds: group.companyIds ? JSON.parse(group.companyIds) : [],
        createdAt: group.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const group = await prisma.companyGroup.findUnique({ where: { id } });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const companyIds: string[] = group.companyIds ? JSON.parse(group.companyIds) : [];

    const companies = companyIds.length > 0
      ? await prisma.company.findMany({
          where: { placeId: { in: companyIds } },
          select: { placeId: true, name: true, services: true },
        })
      : [];

    res.json({
      data: {
        id: group.id,
        name: group.name,
        companyIds,
        createdAt: group.createdAt.toISOString(),
        companies: companies.map((c) => ({
          placeId: c.placeId,
          name: c.name,
          services: c.services ? JSON.parse(c.services) : [],
        })),
      },
    });
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, companyIds } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (companyIds !== undefined) data.companyIds = JSON.stringify(companyIds);

    const group = await prisma.companyGroup.update({
      where: { id },
      data,
    });

    res.json({
      data: {
        id: group.id,
        name: group.name,
        companyIds: group.companyIds ? JSON.parse(group.companyIds) : [],
        createdAt: group.createdAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.companyGroup.delete({ where: { id } });
    res.json({ data: { success: true } });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
