import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import prisma from './db.js';
import { SELECTORS, SCRAPER } from '../shared/constants.js';

puppeteer.use(StealthPlugin());

function delay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScrapedReview {
  reviewId: string;
  author: string;
  rating: number;
  text: string;
  hasResponse: boolean;
}

async function scrapeCompany(
  placeId: string,
  url: string
): Promise<{ newReviews: number; error?: string }> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to the reviews page
    const reviewsUrl = url.includes('?')
      ? `${url}&hl=en`
      : `${url}?hl=en`;
    await page.goto(reviewsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(SCRAPER.minDelay, SCRAPER.maxDelay);

    // Try to sort by newest
    try {
      await page.waitForSelector(SELECTORS.reviewSortButton, { timeout: 5000 });
      await page.click(SELECTORS.reviewSortButton);
      await delay(500, 1000);
      await page.waitForSelector(SELECTORS.reviewSortNewest, { timeout: 3000 });
      await page.click(SELECTORS.reviewSortNewest);
      await delay(SCRAPER.minDelay, SCRAPER.maxDelay);
    } catch {
      // Sort might not be available, continue anyway
    }

    // Scroll to load reviews
    let consecutiveExisting = 0;
    let totalNew = 0;

    for (let scroll = 0; scroll < SCRAPER.maxScrollAttempts; scroll++) {
      // Extract visible reviews
      const reviews = await page.evaluate((selectors) => {
        const containers = document.querySelectorAll(selectors.reviewContainer);
        const results: ScrapedReview[] = [];

        containers.forEach((el) => {
          const reviewId = el.getAttribute(selectors.reviewId);
          if (!reviewId) return;

          const ratingEl = el.querySelector(selectors.reviewRating);
          const ratingMatch = ratingEl?.getAttribute('aria-label')?.match(/(\d)/);
          const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

          const authorEl = el.querySelector(selectors.reviewAuthor);
          const author = authorEl?.textContent?.trim() || '';

          const textEl = el.querySelector(selectors.reviewText);
          const text = textEl?.textContent?.trim() || '';

          const responseEl = el.querySelector(selectors.businessResponse);
          const hasResponse = !!responseEl;

          results.push({ reviewId, author, rating, text, hasResponse });
        });

        return results;
      }, SELECTORS);

      // Check each review against DB
      for (const review of reviews) {
        if (!review.rating) continue;

        const existing = await prisma.review.findUnique({
          where: { reviewId: review.reviewId },
        });

        if (existing) {
          consecutiveExisting++;
          if (consecutiveExisting >= SCRAPER.consecutiveExistingThreshold) {
            // We've caught up — stop scrolling
            break;
          }
          continue;
        }

        consecutiveExisting = 0;

        await prisma.review.create({
          data: {
            reviewId: review.reviewId,
            placeId,
            author: review.author || null,
            rating: review.rating,
            reviewText: review.text || null,
            reviewDate: new Date(),
            hasResponse: review.hasResponse,
            scrapedAt: new Date(),
          },
        });

        totalNew++;
      }

      if (consecutiveExisting >= SCRAPER.consecutiveExistingThreshold) {
        break;
      }

      // Scroll down
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el) el.scrollTop = el.scrollHeight;
      }, SELECTORS.scrollContainer);

      await delay(SCRAPER.scrollPause, SCRAPER.scrollPause + 1000);
    }

    // Recalculate metadata
    const allReviews = await prisma.review.findMany({
      where: { placeId },
      select: { rating: true },
    });

    const scrapedReviews = allReviews.length;
    const calculatedAvg = scrapedReviews > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / scrapedReviews
      : null;

    await prisma.reviewMetadata.upsert({
      where: { placeId },
      update: {
        scrapedReviews,
        calculatedAvg,
        lastScraped: new Date(),
      },
      create: {
        placeId,
        scrapedReviews,
        calculatedAvg,
        lastScraped: new Date(),
      },
    });

    return { newReviews: totalNew };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scrape error for ${placeId}:`, message);
    return { newReviews: 0, error: message };
  } finally {
    if (browser) await browser.close();
  }
}

export async function runWeeklyRefresh() {
  const companies = await prisma.company.findMany({
    where: { url: { not: null } },
    select: { placeId: true, name: true, url: true },
  });

  const results = [];

  for (const company of companies) {
    if (!company.url) continue;

    console.log(`Scraping: ${company.name}`);
    const result = await scrapeCompany(company.placeId, company.url);
    results.push({
      placeId: company.placeId,
      name: company.name,
      newReviews: result.newReviews,
      success: !result.error,
      error: result.error,
    });

    // Delay between companies
    await delay(SCRAPER.minDelay * 2, SCRAPER.maxDelay * 2);
  }

  return results;
}

// Allow running directly: npx tsx src/server/scraper.ts
if (process.argv[1]?.endsWith('scraper.ts')) {
  runWeeklyRefresh()
    .then((results) => {
      console.log('Scrape complete:', results);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Scrape failed:', err);
      process.exit(1);
    });
}
