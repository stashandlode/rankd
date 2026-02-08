import { Router, Request, Response } from 'express';
import puppeteer from 'puppeteer';
import { requireAuth } from '../middleware/auth.js';
import { buildRankings } from './comparisons.js';
import prisma from '../db.js';
import type { CompanyRanking } from '../../shared/types.js';

const router = Router();

router.use(requireAuth);

function generateHtml(rankings: CompanyRanking[], title: string): string {
  const date = new Date().toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = rankings.map((r) => `
    <tr style="${r.isOurCompany ? 'background: #eff6ff;' : ''}">
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 500; color: ${r.rank <= 3 ? '#d97706' : '#6b7280'};">${r.rank}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: ${r.isOurCompany ? '600' : '400'};">${r.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${r.calculatedAvg.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${r.reviewCount.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${Math.abs(r.recentTrend) < 0.1 ? '#9ca3af' : r.recentTrend > 0 ? '#16a34a' : '#dc2626'};">
        ${Math.abs(r.recentTrend) < 0.1 ? '—' : (r.recentTrend > 0 ? '+' : '') + r.recentTrend.toFixed(2)}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${r.reviewVelocity}/mo</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${r.responseRate.toFixed(0)}%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #111827; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .date { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { padding: 10px 8px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    th:not(:first-child):not(:nth-child(2)) { text-align: center; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="date">Generated ${date}</div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Company</th>
        <th>Avg Rating</th>
        <th>Reviews</th>
        <th>Trend (3mo)</th>
        <th>Velocity</th>
        <th>Response</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { filter, groupId, snapshotId } = req.body;
    let rankings: CompanyRanking[];
    let title = 'Competitor Comparison';

    if (snapshotId) {
      const snapshot = await prisma.comparisonSnapshot.findUnique({
        where: { id: snapshotId },
      });
      if (!snapshot) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      rankings = JSON.parse(snapshot.rankings);
      title = `${snapshot.comparisonName} — ${new Date(snapshot.createdAt).toLocaleDateString()}`;
    } else if (groupId) {
      const group = await prisma.companyGroup.findUnique({
        where: { id: groupId },
      });
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      const placeIds: string[] = group.companyIds ? JSON.parse(group.companyIds) : [];
      rankings = await buildRankings(placeIds);
      title = `Competitor Comparison — ${group.name}`;
    } else {
      let placeIds: string[] | undefined;
      const f = filter || 'all';

      if (f !== 'all') {
        const companies = await prisma.company.findMany({
          select: { placeId: true, services: true },
        });
        placeIds = companies
          .filter((c) => {
            const services: string[] = c.services ? JSON.parse(c.services) : [];
            switch (f) {
              case 'removals': return services.includes('Removals');
              case 'self-storage': return services.includes('Self-Storage');
              case 'mobile-storage': return services.includes('Mobile Storage');
              case 'removals-and-storage': return services.includes('Removals') && services.includes('Self-Storage');
              default: return true;
            }
          })
          .map((c) => c.placeId);
      }

      rankings = await buildRankings(placeIds);
      const filterLabels: Record<string, string> = {
        all: 'All Companies',
        removals: 'Removals',
        'self-storage': 'Self-Storage',
        'mobile-storage': 'Mobile Storage',
        'removals-and-storage': 'Removals + Storage',
      };
      title = `Competitor Comparison — ${filterLabels[f] || f}`;
    }

    const html = generateHtml(rankings, title);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });
    await browser.close();

    const filename = `rankd-comparison-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

export default router;
