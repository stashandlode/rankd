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
- **cookie-session** or **jose** - Session management

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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Companies (all businesses tracked)
CREATE TABLE companies (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  is_our_company BOOLEAN DEFAULT false,
  services TEXT,  -- JSON: ["Removals", "Self-Storage", "Mobile Storage"]
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: exactly one company marked as "ours"
CREATE UNIQUE INDEX idx_one_our_company ON companies(is_our_company)
WHERE is_our_company = true;

-- Company Groups (optional manual curation)
CREATE TABLE company_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_ids TEXT,  -- JSON: array of place_id values
  created_at TIMESTAMP DEFAULT NOW()
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
  scraped_at TIMESTAMP DEFAULT NOW()
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
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Routes

```
# Authentication
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session

# User Management (admin only)
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

# Settings
GET    /api/settings/our-company
PUT    /api/settings/our-company

# Companies
GET    /api/companies
GET    /api/companies/:placeId
PUT    /api/companies/:placeId
POST   /api/reviews/import

# Company Groups
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
PUT    /api/groups/:id
DELETE /api/groups/:id

# Comparisons
GET    /api/comparisons?filter=removals-only
GET    /api/comparisons?group=1
GET    /api/comparisons/snapshots
GET    /api/comparisons/snapshots/:id

# Export
POST   /api/export/pdf

# Cron (internal)
POST   /api/cron/weekly-refresh
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
// Calculated Average (to 2 decimal places)
const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

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

// Recent Trend (3, 6, 12 months vs all-time)
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

# Start dev servers (client + server concurrently)
npm run dev

# Run database migrations
npx prisma migrate dev

# Run weekly scrape manually
npm run scrape
```

### Git Commit Conventions
- Incremental, modular commits
- Commit progressively as features are completed
- Clear commit messages describing what changed

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
4. **~5% reviews missing** - Google's count ≠ DOM count, this is expected
5. **Puppeteer memory usage** - Railway container needs sufficient RAM (~1GB)
6. **Session management** - Use secure httpOnly cookies, not localStorage

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
