import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      data: companies.map((c) => ({
        placeId: c.placeId,
        name: c.name,
        url: c.url,
        isOurCompany: c.isOurCompany,
        services: c.services ? JSON.parse(c.services) : [],
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List companies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:placeId', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params;

    const company = await prisma.company.findUnique({
      where: { placeId },
      include: { metadata: true },
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.json({
      data: {
        company: {
          placeId: company.placeId,
          name: company.name,
          url: company.url,
          isOurCompany: company.isOurCompany,
          services: company.services ? JSON.parse(company.services) : [],
          createdAt: company.createdAt.toISOString(),
        },
        metadata: company.metadata
          ? {
              totalReviews: company.metadata.totalReviews,
              scrapedReviews: company.metadata.scrapedReviews,
              calculatedAvg: company.metadata.calculatedAvg,
              lastScraped: company.metadata.lastScraped?.toISOString() ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Get company error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:placeId', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params;
    const { name, url, services } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url;
    if (services !== undefined) data.services = JSON.stringify(services);

    const company = await prisma.company.update({
      where: { placeId },
      data,
    });

    res.json({
      data: {
        placeId: company.placeId,
        name: company.name,
        url: company.url,
        isOurCompany: company.isOurCompany,
        services: company.services ? JSON.parse(company.services) : [],
        createdAt: company.createdAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
