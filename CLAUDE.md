# CLAUDE.md

This file provides guidance to AI coding assistants when working on code in this repository.

## Project Overview

**Rankd** is an internal competitive intelligence tool for Stash + Lode Storage. It compares Stash + Lode against 11-20 local competitors by analyzing their Google Maps reviews with greater precision than Google's standard rounded ratings.

**For full product requirements, see [PRD.md](./PRD.md)**

## Quick Context

- **Team:** 2-5 users at Stash + Lode Storage
- **Use Case:** Monthly competitive analysis with weekly automated data refresh
- **Timeline:** MVP launch in 1-2 weeks
- **Key Value:** Calculate precise averages from ALL reviews (not Google's rounded 1-decimal rating)

## Technology Stack

**Language:**
- **TypeScript** - Used throughout (strict mode), shared types between client and server

**Frontend:**
- **Vite** - Build tool and dev server
- **React** - UI components
- **Tailwind CSS** - Styling
- **TanStack Query** - Async data fetching and caching
- **TanStack Table** - Sortable, filterable comparison table

**Backend:**
- **Express** - API server + serves built static files
- **Prisma** - ORM for type-safe database queries
- **SQLite** - Database (single file on disk)
- **bcrypt** - Password hashing
- **cookie-session** - Signed cookie-based sessions (stateless, no Redis needed)

**Automation:**
- **node-cron** - Weekly scraping scheduler (runs Sunday 00:00)
- **Puppeteer** - Headless Chrome for web scraping + PDF generation
- **puppeteer-extra-plugin-stealth** - Evade scraping detection

**Hosting:**
- **Railway** - Persistent container with filesystem (for SQLite)

## Database Schema (6 Tables)

```sql
-- Users (authentication and user management)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies (all businesses tracked)
CREATE TABLE companies (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  is_our_company BOOLEAN DEFAULT false,
  services TEXT,  -- JSON: ["Removals", "Self-Storage", "Mobile Storage"]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: exactly one company marked as "ours"
CREATE UNIQUE INDEX idx_one_our_company ON companies(is_our_company)
WHERE is_our_company = true;

-- Company Groups (optional manual curation)
CREATE TABLE company_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_ids TEXT,  -- JSON: array of place_id values
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews (individual review records)
CREATE TABLE reviews (
  review_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES companies(place_id) ON DELETE CASCADE,
  author TEXT,
  rating INTEGER NOT NULL,  -- 1-5
  review_text TEXT,
  review_date TIMESTAMP,
  has_response BOOLEAN DEFAULT false,
  response_text TEXT,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Review Metadata (per-company tracking)
CREATE TABLE review_metadata (
  place_id TEXT PRIMARY KEY REFERENCES companies(place_id) ON DELETE CASCADE,
  total_reviews INTEGER,      -- What Google displays (e.g., 228)
  scraped_reviews INTEGER,    -- What we have in DB (e.g., 215)
  calculated_avg REAL,        -- Precise average (e.g., 4.88)
  last_scraped TIMESTAMP
);

-- Comparison Snapshots (historical tracking)
CREATE TABLE comparison_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comparison_name TEXT NOT NULL,
  rankings TEXT,  -- JSON: full comparison data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Routes & Contracts

All responses use `{ data: ... }` on success and `{ error: string }` on failure.
Authentication-required endpoints return `401` if no session. Admin-only endpoints return `403` for non-admin users.

### Authentication

```
POST /api/auth/login
  Request:  { username: string, password: string }
  Response: { data: { id: number, username: string, role: "admin" | "user" } }

POST /api/auth/logout
  Response: { data: { success: true } }

GET /api/auth/session
  Response: { data: { id: number, username: string, role: "admin" | "user" } }
  401 if not authenticated
```

### User Management (admin only)

```
GET /api/users
  Response: { data: [{ id, username, role, createdAt }] }

POST /api/users
  Request:  { username: string, password: string, role: "admin" | "user" }
  Response: { data: { id, username, role, createdAt } }

PUT /api/users/:id
  Request:  { username?: string, password?: string, role?: string }
  Response: { data: { id, username, role, createdAt } }

DELETE /api/users/:id
  Response: { data: { success: true } }
```

### Settings

```
GET /api/settings/our-company
  Response: { data: { placeId: string | null } }

PUT /api/settings/our-company
  Request:  { placeId: string }
  Response: { data: { success: true } }
```

### Companies

```
GET /api/companies
  Response: { data: [{ placeId, name, url, isOurCompany, services, createdAt }] }

GET /api/companies/:placeId
  Response: { data: { company: { placeId, name, url, isOurCompany, services, createdAt },
                       metadata: { totalReviews, scrapedReviews, calculatedAvg, lastScraped } } }

PUT /api/companies/:placeId
  Request:  { name?: string, url?: string, services?: string[] }
  Response: { data: { placeId, name, url, isOurCompany, services, createdAt } }
```

### Review Import

```
POST /api/reviews/import
  Request: extraction script JSON output (see "Import Format" below)
  Response: { data: { company: { placeId, name }, reviewsImported: number, reviewsSkipped: number } }
```

**Import Format** — accepts the output of `scripts/extract-reviews-console.js` (extra fields like `metrics` are ignored):
```json
{
  "business": {
    "name": "Company Name",
    "overallRating": 4.5,
    "totalReviews": 247,
    "placeId": "ChIJ...",
    "url": "https://www.google.com/maps/place/..."
  },
  "reviews": [
    {
      "reviewId": "abc123",
      "author": "John Smith",
      "rating": 5,
      "text": "Great service...",
      "dateText": "2 weeks ago",
      "hasBusinessResponse": true,
      "extractedAt": "2026-01-28T10:30:00Z"
    }
  ],
  "metadata": {
    "extractedAt": "2026-01-28T10:30:00Z"
  }
}
```

**Import behavior:**
- Creates the company record if `placeId` doesn't exist yet
- Skips reviews whose `reviewId` already exists (deduplication)
- Converts `dateText` to approximate timestamp relative to `metadata.extractedAt`
- Updates `review_metadata` (totals, calculated average, last scraped timestamp)

### Company Groups

```
GET /api/groups
  Response: { data: [{ id, name, companyIds, createdAt }] }

POST /api/groups
  Request:  { name: string, companyIds: string[] }
  Response: { data: { id, name, companyIds, createdAt } }

GET /api/groups/:id
  Response: { data: { id, name, companyIds, createdAt, companies: [{ placeId, name, services }] } }

PUT /api/groups/:id
  Request:  { name?: string, companyIds?: string[] }
  Response: { data: { id, name, companyIds, createdAt } }

DELETE /api/groups/:id
  Response: { data: { success: true } }
```

### Comparisons

```
GET /api/comparisons
  Query params (pick one):
    ?filter=all | removals | self-storage | mobile-storage | removals-and-storage
    ?group=<groupId>
  Response: { data: { rankings: [CompanyRanking], filter: string } }

  Filter logic:
    all              → all companies
    removals         → companies with "Removals" in services
    self-storage     → companies with "Self-Storage" in services
    mobile-storage   → companies with "Mobile Storage" in services
    removals-and-storage → companies with BOTH "Removals" AND "Self-Storage" in services

  CompanyRanking = {
    rank: number,
    placeId: string,
    name: string,
    url: string,
    isOurCompany: boolean,
    services: string[],
    calculatedAvg: number,        // 2 decimal places
    reviewCount: number,
    ratingDistribution: { 5: { count, percent }, 4: {...}, 3: {...}, 2: {...}, 1: {...} },
    recentTrend: number,          // 3-month trend (positive = improving, negative = declining)
    reviewVelocity: number,       // reviews/month (last 3 months)
    responseRate: number           // percentage
  }

GET /api/comparisons/snapshots
  Response: { data: [{ id, comparisonName, createdAt }] }

GET /api/comparisons/snapshots/:id
  Response: { data: { id, comparisonName, rankings: [CompanyRanking], createdAt } }
```

### Export

```
POST /api/export/pdf
  Request:  { filter?: string, groupId?: number, snapshotId?: number }
  Response: PDF file (Content-Type: application/pdf)
```

### Cron (internal)

```
POST /api/cron/weekly-refresh
  Response: { data: { results: [{ placeId, name, newReviews: number, success: boolean, error?: string }] } }
```

## Key Technical Decisions & Constraints

### Data Collection Strategy

**Why web scraping instead of Google Places API:**
- Low review volumes (~250 reviews max per company)
- Need ALL reviews for precise average calculation
- API only provides ~5-50 recent reviews
- One-time initial data dump, then small incremental updates

**Two-phase approach:**
1. **Initial (one-time):** Browser console script extracts all reviews manually (~30-60 min for 20 companies)
2. **Ongoing (weekly):** Puppeteer scrapes only new reviews (1-2 pages per company)

**Company creation:** Companies are created automatically when review JSON files are imported via the `/api/reviews/import` endpoint. There is no separate company search/autocomplete UI in MVP.

### Web Scraping Implementation

**Google Maps DOM selectors:**
- Primary selector: `div.jftiEf` (review containers)
- Business name: Extract from URL path (`/place/[name]/`)
- Review count: Text matching `/^(\d+(?:,\d+)?)\s+reviews?$/i`
- **IMPORTANT:** These selectors are fragile and break with Google UI updates. Maintain them in a constants file.

**Deduplication strategy:**
- Use `data-review-id` attribute (permanent, unique identifier)
- More reliable than date-based ("1 week ago" is imprecise and changes over time)

**Early-stop optimization:**
- If 5+ consecutive reviews already in database → stop scraping (caught up)

**~5% review gap:**
- Google's displayed count includes removed/filtered/spam reviews not in DOM
- All competitors affected equally, so relative rankings remain fair

### SQLite Constraints

- **No concurrent writes:** SQLite can't handle multiple simultaneous writes
- **Structure accordingly:** Weekly scrape runs sequentially (one company at a time)
- **Transaction strategy:** Wrap multi-step operations in transactions

### Authentication Model

- Individual user accounts with username/password (not shared password)
- Role-based access: `admin` (can manage users, import data) vs `user` (read-only comparisons)
- Admin can create users and reset passwords

## Metrics Calculations

```javascript
// Calculated Average (5 decimal places internally, displayed as 2)
// Precision matters: companies with identical 2-decimal averages must rank correctly
const avg = parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(5));

// Rating Distribution (count and %)
const dist = {
  5: { count: 0, percent: 0 },
  4: { count: 0, percent: 0 },
  // ...
};
reviews.forEach(r => dist[r.rating].count++);
Object.keys(dist).forEach(rating => {
  dist[rating].percent = (dist[rating].count / reviews.length * 100).toFixed(1);
});

// Recent Trend (3 months vs all-time)
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const recentReviews = reviews.filter(r => r.review_date >= threeMonthsAgo);
const recentAvg = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
const trend = recentAvg - avg;  // Positive = improving, negative = declining

// Review Velocity (reviews/month in last 3 months)
const velocity = recentReviews.length / 3;

// Response Rate (%)
const responseRate = (reviews.filter(r => r.has_response).length / reviews.length) * 100;
```

## Development Workflow

### Project Structure
```
/src
  /client       - React app (Vite)
  /server       - Express API
  /shared       - Types, constants shared between client/server
/scripts        - Browser console extraction script
/prisma         - Prisma schema and migrations
```

### Running Locally
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed initial admin user (admin / changeme — must change on first login)
npx prisma db seed

# Start dev servers (client + server concurrently)
# Vite dev server proxies /api requests to Express backend (configured in vite.config.ts)
npm run dev

# Run weekly scrape manually
npm run scrape
```

## Code Style & Conventions

*(To be established during development)*

- Formatting: 2 spaces, semicolons, single quotes
- Naming: camelCase for variables/functions, PascalCase for components
- Imports: group by external → internal → relative
- Error handling: (TBD)
- Testing approach: (TBD)

## Gotchas & Important Notes

1. **Google Maps selectors break frequently** - Maintain them in `src/shared/constants.ts`
2. **SQLite has no concurrent write support** - Keep scraping sequential
3. **Review dates are imprecise** - "2 weeks ago" not timestamps, use for trends only
4. **Review date conversion** - The extraction script produces relative date strings ("2 weeks ago"). During import, convert to approximate absolute timestamps based on the `extractedAt` date. Precision is not critical — dates are only used for the 3-month trend calculation and review velocity.
5. **~5% reviews missing** - Google's count ≠ DOM count, this is expected
6. **Puppeteer memory usage** - Railway container needs sufficient RAM (~1GB)
7. **Session management** - Use secure httpOnly cookies, not localStorage
8. **First admin user** - Created via `npx prisma db seed` (username: `admin`, password: `changeme`). Admin must change password after first login.

## Success Criteria

**Performance:**
- Comparison loads < 10 seconds
- Weekly scrape success rate > 95%
- Mobile responsive

**Functional:**
- Team completes monthly comparisons in < 2 minutes
- Calculated ratings show 2+ decimal precision
- PDF exports are professional and readable
- Stash + Lode always visually highlighted

---

## Git Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
Commit incrementally as features are completed.

**Format:**
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Common types:**
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation only
- `refactor:` Code restructuring without behavior change
- `test:` Test additions or modifications
- `chore:` Routine maintenance and updates
- `perf:` Performance improvements

**Best practices:**
- Use imperative mood: "add feature" not "added feature"
- Keep subject line ≤ 50 characters
- Separate subject from body with blank line
- Use body to explain "what and why" vs "how"
- No period at end of subject line
- First commit can omit type prefix (e.g., "Initial revision of Rankd...")

**Privacy note:**
- Avoid explicit references to data sources in commit messages to maintain discretion
