import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { CompanyRanking, RatingBucket } from '../../shared/types.js';

const router = Router();

router.use(requireAuth);

async function buildRankings(placeIds?: string[]): Promise<CompanyRanking[]> {
  const where = placeIds ? { placeId: { in: placeIds } } : {};

  const companies = await prisma.company.findMany({
    where,
    include: { metadata: true },
  });

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const rankings: CompanyRanking[] = [];

  for (const company of companies) {
    const reviews = await prisma.review.findMany({
      where: { placeId: company.placeId },
    });

    if (reviews.length === 0) continue;

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const calculatedAvg = parseFloat((totalRating / reviews.length).toFixed(2));

    // Rating distribution
    const dist: Record<number, RatingBucket> = {};
    for (let i = 1; i <= 5; i++) {
      dist[i] = { count: 0, percent: 0 };
    }
    reviews.forEach((r) => { dist[r.rating].count++; });
    for (let i = 1; i <= 5; i++) {
      dist[i].percent = parseFloat(((dist[i].count / reviews.length) * 100).toFixed(1));
    }

    // Recent trend
    const recentReviews = reviews.filter(
      (r) => r.reviewDate && r.reviewDate >= threeMonthsAgo
    );
    let recentTrend = 0;
    if (recentReviews.length > 0) {
      const recentAvg = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
      recentTrend = parseFloat((recentAvg - calculatedAvg).toFixed(2));
    }

    // Review velocity (reviews/month over last 3 months)
    const reviewVelocity = parseFloat((recentReviews.length / 3).toFixed(1));

    // Response rate
    const responded = reviews.filter((r) => r.hasResponse).length;
    const responseRate = parseFloat(((responded / reviews.length) * 100).toFixed(1));

    rankings.push({
      rank: 0,
      placeId: company.placeId,
      name: company.name,
      url: company.url,
      isOurCompany: company.isOurCompany,
      services: company.services ? JSON.parse(company.services) : [],
      calculatedAvg,
      reviewCount: reviews.length,
      ratingDistribution: dist as Record<1 | 2 | 3 | 4 | 5, RatingBucket>,
      recentTrend,
      reviewVelocity,
      responseRate,
    });
  }

  // Sort: by calculated average desc, then review count desc as tiebreaker
  rankings.sort((a, b) => {
    if (Math.abs(a.calculatedAvg - b.calculatedAvg) >= 0.01) {
      return b.calculatedAvg - a.calculatedAvg;
    }
    return b.reviewCount - a.reviewCount;
  });

  // Assign ranks
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

function filterByServices(companies: { placeId: string; services: string | null }[], filter: string): string[] {
  return companies
    .filter((c) => {
      const services: string[] = c.services ? JSON.parse(c.services) : [];
      switch (filter) {
        case 'removals':
          return services.includes('Removals');
        case 'self-storage':
          return services.includes('Self-Storage');
        case 'mobile-storage':
          return services.includes('Mobile Storage');
        case 'removals-and-storage':
          return services.includes('Removals') && services.includes('Self-Storage');
        default:
          return true;
      }
    })
    .map((c) => c.placeId);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter = (req.query.filter as string) || 'all';
    const groupId = req.query.group as string | undefined;

    let placeIds: string[] | undefined;

    if (groupId) {
      const group = await prisma.companyGroup.findUnique({
        where: { id: parseInt(groupId, 10) },
      });
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      placeIds = group.companyIds ? JSON.parse(group.companyIds) : [];
    } else if (filter !== 'all') {
      const allCompanies = await prisma.company.findMany({
        select: { placeId: true, services: true },
      });
      placeIds = filterByServices(allCompanies, filter);
    }

    const rankings = await buildRankings(placeIds);

    res.json({
      data: {
        rankings,
        filter: groupId ? `group:${groupId}` : filter,
      },
    });
  } catch (err) {
    console.error('Comparisons error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/snapshots', async (_req: Request, res: Response) => {
  try {
    const snapshots = await prisma.comparisonSnapshot.findMany({
      select: { id: true, comparisonName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: snapshots.map((s) => ({
        id: s.id,
        comparisonName: s.comparisonName,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List snapshots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const snapshot = await prisma.comparisonSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.json({
      data: {
        id: snapshot.id,
        comparisonName: snapshot.comparisonName,
        rankings: JSON.parse(snapshot.rankings),
        createdAt: snapshot.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Get snapshot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { buildRankings };
export default router;
