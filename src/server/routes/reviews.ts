import { Router, Request, Response } from 'express';
import prisma from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * Parse relative date text like "2 weeks ago" into an approximate Date,
 * relative to the extractedAt timestamp.
 */
function parseDateText(dateText: string, extractedAt: Date): Date | null {
  const text = dateText.toLowerCase().trim();
  const match = text.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);

  if (!match) {
    // Try "a week ago", "an hour ago", etc.
    const singleMatch = text.match(/^(?:a|an)\s+(second|minute|hour|day|week|month|year)\s+ago$/);
    if (singleMatch) {
      return subtractTime(extractedAt, 1, singleMatch[1]);
    }
    return null;
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  return subtractTime(extractedAt, amount, unit);
}

function subtractTime(from: Date, amount: number, unit: string): Date {
  const d = new Date(from);
  switch (unit) {
    case 'second': d.setSeconds(d.getSeconds() - amount); break;
    case 'minute': d.setMinutes(d.getMinutes() - amount); break;
    case 'hour': d.setHours(d.getHours() - amount); break;
    case 'day': d.setDate(d.getDate() - amount); break;
    case 'week': d.setDate(d.getDate() - amount * 7); break;
    case 'month': d.setMonth(d.getMonth() - amount); break;
    case 'year': d.setFullYear(d.getFullYear() - amount); break;
  }
  return d;
}

router.post('/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { business, reviews, metadata } = req.body;

    if (!business?.placeId || !business?.name || !Array.isArray(reviews)) {
      res.status(400).json({ error: 'Invalid import format: business.placeId, business.name, and reviews array required' });
      return;
    }

    const extractedAt = metadata?.extractedAt ? new Date(metadata.extractedAt) : new Date();

    // Upsert company
    await prisma.company.upsert({
      where: { placeId: business.placeId },
      update: {
        name: business.name,
        url: business.url || null,
      },
      create: {
        placeId: business.placeId,
        name: business.name,
        url: business.url || null,
      },
    });

    // Import reviews, skipping duplicates
    let imported = 0;
    let skipped = 0;

    for (const review of reviews) {
      if (!review.reviewId) {
        skipped++;
        continue;
      }

      const existing = await prisma.review.findUnique({
        where: { reviewId: review.reviewId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const reviewDate = review.dateText
        ? parseDateText(review.dateText, extractedAt)
        : null;

      await prisma.review.create({
        data: {
          reviewId: review.reviewId,
          placeId: business.placeId,
          author: review.author || null,
          rating: review.rating,
          reviewText: review.text || null,
          reviewDate,
          hasResponse: review.hasBusinessResponse || false,
          responseText: null,
          scrapedAt: extractedAt,
        },
      });

      imported++;
    }

    // Recalculate metadata
    const allReviews = await prisma.review.findMany({
      where: { placeId: business.placeId },
      select: { rating: true },
    });

    const scrapedReviews = allReviews.length;
    const calculatedAvg = scrapedReviews > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / scrapedReviews
      : null;

    await prisma.reviewMetadata.upsert({
      where: { placeId: business.placeId },
      update: {
        totalReviews: business.totalReviews || scrapedReviews,
        scrapedReviews,
        calculatedAvg,
        lastScraped: extractedAt,
      },
      create: {
        placeId: business.placeId,
        totalReviews: business.totalReviews || scrapedReviews,
        scrapedReviews,
        calculatedAvg,
        lastScraped: extractedAt,
      },
    });

    res.json({
      data: {
        company: { placeId: business.placeId, name: business.name },
        reviewsImported: imported,
        reviewsSkipped: skipped,
      },
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
