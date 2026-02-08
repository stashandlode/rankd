# Product Requirements Document: Rankd

**Version:** 1.0
**Date:** January 28, 2026
**Status:** Draft

---

## 1. Executive Summary

**Product Name:** Rankd

**Purpose:** Rankd is an internal competitive intelligence tool for Stash + Lode Storage. It enables the team to track SNL's customer satisfaction performance against local competitors by analyzing Google Maps reviews with greater precision than Google's standard rounded ratings.

**Key Value:** Calculate precise average ratings from ALL individual reviews (not Google's rounded 1-decimal rating) to differentiate between competitors who appear tied on Google Maps.

---

## 2. Problem Statement

### Current Challenges
- No easy way to compare SNL customer satisfaction performance against local competitors
- Manual competitor tracking via Google Maps is time-consuming
- No systematic way to track competitive position changes over time
- Google rounds each company’s ratings average to 1 decimal place (e.g., 4.5 stars), meaning multiple competitors often have identical rounded ratings, making ranking difficult
- Difficult to analyze performance trends and review velocity

### Solution
Rankd scrapes ALL individual reviews for each competitor to calculate precise average ratings (to 2+ decimal places). This provides:
- Clear differentiation when competitors appear tied on Google
- Comprehensive metrics: rating distribution, recent trends, review velocity, response rate
- Automated weekly data refresh with monthly snapshot tracking
- Professional PDF reports for team meetings

---

## 3. Target Users

**Team:** 2-5 people at Stash + Lode Storage (employees and owners)

**Primary Use Case:** Monthly competitive analysis to understand market position

**User Goals:**
- Know where Stash + Lode ranks among local competitors
- Identify performance trends (improving vs declining)
- Benchmark against top performers
- Generate reports for management meetings

---

## 4. User Stories

### Must Have (MVP - 1-2 Weeks)

**Authentication & Settings**
1. As a team member, I want to log in with my username and password to access the tool
2. As an admin user, I want to log in with my username and password to access the tool and manage settings and users
3. As an admin user, I want to mark "Stash + Lode Storage" as our company so it's automatically highlighted in all rankings

**Company & Group Management**
4. As an admin user, I want to import companies from Google Maps review data
5. As a user, I want each company to have service type tags (Removals, Self-Storage, Mobile Storage)
6. As a user, I want to create optional named groups (e.g., "Primary Competitors", "Melbourne Top 20")
7. As a user, I want to view comparisons by service type OR by named group

**Data & Metrics**
8. As a user, I want to see calculated average ratings with 2+ decimal precision so I can differentiate similar competitors
9. As a user, I want to see review count as a credibility indicator
10. As a user, I want to see rating distribution (count and % of 5★, 4★, 3★, 2★, 1★)
11. As a user, I want to see recent trend (last 3 months vs overall average) to know if ratings are improving/declining
12. As a user, I want to see review velocity (reviews/month) to understand engagement levels
13. As a user, I want to see response rate to know which competitors engage with reviews

**Rankings & Comparison**
14. As a user, I want companies automatically ranked by calculated average (with review count as tiebreaker)
15. As a user, I want Stash + Lode visually highlighted so I can quickly see our position
16. As a user, I want a single dropdown to select comparison type (by service filter OR by named group)
17. As a user, I want the ability to reorder ranking based on any of the metrics in the table

**Historical Tracking**
18. As a user, I want the system to automatically refresh data weekly so information stays current
19. As a user, I want to view saved snapshots so I can see how rankings have changed over time

**Reporting**
20. As a user, I want to export comparisons to PDF for management meetings
21. As a user, I want PDFs to be clean and professional for management meetings

### Should Have (V2 - Post-MVP)
22. Timeline/chart view showing ranking changes over time
23. Email alerts when rankings change significantly

### Nice to Have (Future)
24. Sentiment analysis of recent reviews
25. Word cloud analysis of all reviews
26. Competitor insights dashboard
27. Excel/CSV export for custom analysis

---

## 5. Core Features

### 5.1 Authentication

**Individual User Accounts**

- Each team member has their own username and password
- Role-based access: `admin` (manage users, import data, modify settings) vs `user` (read-only comparisons)
- Passwords stored securely (bcrypt hashing)
- Session persistence (stay logged in)
- No self-registration — admin creates user accounts
- Admin can reset passwords if needed

---

### 5.2 Settings: Own Company Configuration

**Identify Stash + Lode Storage**

- Boolean flag on company record (`is_our_company`)
- Database constraint ensures exactly one company can be marked as "ours"
- UI: Settings page with company selector to mark which company is Stash + Lode
- Automatically highlight Stash + Lode in all comparison views with distinct background color/badge

---

### 5.3 Company & Group Management

**Company Service Types**
- Each company has a `services` attribute (JSON array)
- Services: ["Removals", "Self-Storage", "Mobile Storage"]
- Companies can offer multiple services (e.g., both Removals and Self-Storage)
- Service types editable after company is imported (import does not include service types)

**Named Company Groups** (Optional Manual Curation)
- Create custom groups with names like "Primary Competitors", "Melbourne Top 20"
- Groups store array of company IDs (JSON array)
- Multiple groups supported
- Same company can appear in multiple groups
- Groups are optional - can also just filter all companies by service type

**Data Structure:**
```
CompanyGroup {
  id: INTEGER (PK, autoincrement)
  name: string  // "Primary Competitors", "Melbourne Top 20"
  company_ids: string[]  // Array of place_id values
  createdAt: timestamp
}

Company {
  place_id: string (PK)
  name: string
  url: string
  is_our_company: boolean
  services: string[]  // ["Removals", "Self-Storage", "Mobile Storage"]
  createdAt: timestamp
}
```

---

### 5.4 Data Collection

**Two-Phase Approach:**

#### Phase 1: Initial Data Dump (One-Time)
**Semi-Manual Browser Console Extraction**

Process:
1. User navigates to company on Google Maps
2. Opens Reviews tab
3. Sorts reviews by date (newest first)
4. Scrolls to bottom to load all reviews (~250 max per company)
5. Opens browser DevTools (F12), runs extraction script in console
6. Script parses DOM and extracts all review data
7. Downloads JSON file with review data
8. Imports JSON into Rankd database

**Estimated Time:** 2-3 minutes per company, ~30-60 minutes for 20 companies

**Extraction Script Output** (matches `scripts/extract-reviews-console.js`):
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
      "reviewId": "unique-id-or-hash",
      "author": "John Smith",
      "rating": 5,
      "text": "Great service...",
      "dateText": "2 weeks ago",
      "hasBusinessResponse": true,
      "extractedAt": "2026-01-28T10:30:00Z"
    }
  ],
  "metadata": {
    "extractedAt": "2026-01-28T10:30:00Z",
    "extractionMethod": "browser-console",
    "version": "1.1"
  }
}
```

#### Phase 2: Automated Incremental Updates (Ongoing)
**Puppeteer Script with Stealth Plugin**

Process:
1. Weekly cron job triggers Puppeteer script
2. For each tracked company:
   - Navigate to the company's Google Maps reviews
   - Sort by newest
   - Scroll to load first 1-2 pages only (~10-20 reviews)
   - Extract reviews and check review IDs against database
   - Add only new reviews (reviews with IDs not in database)
   - Stop early if 5+ consecutive reviews already exist (caught up)
3. Recalculate all metrics from complete dataset
4. Save new comparison snapshot

**Deduplication Strategy:**
- Use review IDs (from `data-review-id` or generated hash) as unique identifiers
- More reliable than date-based comparison (dates like "1 week ago" are imprecise)
- Review IDs are permanent and don't change over time
- Each review ID checked against database before insertion

**Scraping Strategy:**
- Use `puppeteer-extra-plugin-stealth` to reduce detection risk
- Human-like delays between actions (1-3 seconds)
- Random scroll patterns
- Limit to 20 companies, weekly cadence (low volume)
- Only scrape 1-2 pages (~10-20 most recent reviews, not all reviews)
- Fallback: Manual console extraction if automated script fails

**Risk Mitigation:**
- Low scraping volume reduces detection risk (weekly, not daily)
- Minimal scraping (first page only, not full history)
- Manual fallback always available
- Google Maps DOM selectors will be maintained/updated as needed

---

### 5.5 Metrics Calculation

All metrics calculated from stored review data.

#### 5.5.1 Calculated Average Rating
```
sum(all_review_ratings) / count(reviews)
```
**Display:** 2 decimal places (e.g., 4.37)
**Purpose:** More precise than Google's rounded 1-decimal rating

#### 5.5.2 Review Count
**Calculation:** Total number of reviews
**Display:** Integer with comma separator (e.g., 342 reviews)
**Purpose:** Credibility indicator

#### 5.5.3 Rating Distribution
```
5-star: (count of 5★ reviews / total) × 100
4-star: (count of 4★ reviews / total) × 100
3-star: (count of 3★ reviews / total) × 100
2-star: (count of 2★ reviews / total) × 100
1-star: (count of 1★ reviews / total) × 100
```
**Display:** Horizontal bar chart or percentage list
**Purpose:** Understand review composition

#### 5.5.4 Recent Trend (Last 3 Months)
```
recent_avg = avg(reviews from last 3 months)
overall_avg = avg(all reviews)
trend = recent_avg - overall_avg
```
**Display:**
- "↑ +0.3" (green) if improving
- "↓ -0.2" (red) if declining
- "→ stable" (gray) if difference < 0.1

**Purpose:** Identify improving or declining competitors

#### 5.5.5 Review Velocity
```
recent_count = count(reviews from last 3 months)
velocity = recent_count / 3
```
**Display:** "12.5 reviews/month"
**Purpose:** Measure engagement and growth

#### 5.5.6 Response Rate
```
responded = count(reviews with business_response)
response_rate = (responded / total_reviews) × 100
```
**Display:** "68%"
**Purpose:** Measure customer engagement

---

### 5.6 Ranking Algorithm

**Primary Sort:** Calculated average rating (descending)
**Tiebreaker:** Review count (descending)

```javascript
companies.sort((a, b) => {
  // First, compare by calculated average
  if (Math.abs(a.calculatedAvg - b.calculatedAvg) >= 0.01) {
    return b.calculatedAvg - a.calculatedAvg;
  }
  // If within 0.01, use review count as tiebreaker
  return b.reviewCount - a.reviewCount;
});
```

**Rank Display:**
- Show rank number (1, 2, 3...)
- Visual emphasis for top 3 (subtle badge or border)
- Stash + Lode highlighted regardless of rank position

---

### 5.7 Comparison View

**Layout:** Table or card grid (responsive)

**Displayed Data:**
1. Rank (1, 2, 3...)
2. Company Name (Stash + Lode highlighted with background color)
3. Service Type tag(s)
4. Calculated Average Rating (2 decimals + star visualization)
5. Review Count
6. Rating Distribution (visual bar chart)
7. Recent Trend (arrow + number + color)
8. Review Velocity (reviews/month)
9. Response Rate (percentage)
10. Link to Google Maps page (open in new tab)

**Interactions:**
- Single comparison selector dropdown with dividers:
  - Top section: Service type filters ("All Companies", "Removals", "Self-Storage", "Mobile Storage", "Removals + Storage")
    - Note: "Removals + Storage" shows companies offering BOTH removals and storage services
  - Bottom section: Named groups ("Primary Competitors", "Melbourne Top 20", etc.)
- Sort by any column (override default ranking)
- Click company name → open Google Maps page
- Export PDF button (top right)
- Manual "Refresh Data" button (triggers immediate update)

**Visual Design:**
- Stash + Lode: Highlighted background (light blue or yellow)
- Top 3 performers: Subtle visual indicator (small badge/icon)
- Positive trends: Green text/arrows
- Negative trends: Red text/arrows
- Clean, scannable table layout
- Mobile responsive

---

### 5.8 Historical Tracking

**Save Monthly Snapshots**

**Features:**
- Automatically save comparison results after each weekly data refresh
- Tag each snapshot with date/timestamp
- Store complete ranking and metrics for all companies
- List historical snapshots by date (most recent first)
- View any past snapshot in comparison view
- Compare current month vs previous month (side-by-side)

**Data Structure:**
```
ComparisonSnapshot {
  id: INTEGER
  comparisonName: string       // e.g., "All Companies", "Self-Storage Only"
  createdAt: timestamp
  rankings: JSON {             // Full comparison data
    companies: [
      {
        placeId: string
        name: string
        rank: number
        calculatedAvg: number
        reviewCount: number
        ratingDistribution: object
        recentTrend: number
        reviewVelocity: number
        responseRate: number
      }
    ]
  }
}
```

**Note:** Timeline/chart visualization is deferred to V2. MVP stores snapshots for point-in-time viewing.

---

### 5.9 Automated Data Refresh

**Weekly Scheduled Update**

**Schedule:** Every Sunday at midnight (or configurable time)

**Process:**
1. Cron job triggers Puppeteer script
2. For each tracked company:
   - Scrape most recent reviews (first 1-2 pages, ~10-20 reviews)
   - Check each review ID against existing database records
   - Store only new reviews (IDs not in database)
   - Stop early if consecutive reviews already exist (efficiency optimization)
   - Recalculate all metrics from complete dataset
   - Save new comparison snapshot
3. Log results (success/failure per company, count of new reviews added)
4. Optional: Email notification if critical failures occur

**Error Handling:**
- Retry failed companies once
- Log errors for manual review
- Continue processing remaining companies if one fails
- Fallback: Team can manually trigger refresh or use console extraction

---

### 5.10 PDF Export

**Generate Professional PDF Report**

**Content:**
1. Header: "Competitor Comparison - [Filter/Group Name]"
2. Date generated
3. Ranked table with all companies and metrics
4. Stash + Lode highlighted in table
5. Optional summary stats (market average rating, top performer, etc.)

**Format:**
- Clean, professional layout
- Readable fonts and spacing
- No branding/logo needed for MVP (can add in V2)
- File name: `rankd-comparison-[filter-or-group]-YYYY-MM-DD.pdf`

**Technical:**
- Server-side generation (Puppeteer or react-pdf)
- Download as file (not email for MVP)

---

## 6. Technical Architecture

**For complete technical implementation details, see [CLAUDE.md](./CLAUDE.md)**

### 6.1 Database Schema

**6 Core Entities:**

1. **Users** - Individual login accounts with username/password and role-based access (admin vs user)
2. **Companies** - Competitor storage businesses with Google Maps data and service type tags
3. **Company Groups** - Named collections of companies for custom comparisons (e.g., "Primary Competitors")
4. **Reviews** - Individual review data (rating, text, date, author, business response)
5. **Review Metadata** - Per-company tracking (total count, calculated average, last scrape timestamp)
6. **Comparison Snapshots** - Historical point-in-time rankings for monthly tracking

**Key Design Decisions:**
- Individual user accounts (not shared password) with admin role for user management
- Exactly one company can be marked as "ours" for visual highlighting
- Service types are company attributes (["Removals", "Self-Storage", "Mobile Storage"])
- Groups store company IDs as JSON arrays (no junction table)
- Snapshots store comparison name string and full ranking data as JSON
- Reviews deduplicated using Google's `data-review-id` attribute

> **Technical implementation:** See CLAUDE.md for complete database schema SQL

---

### 6.2 API Endpoints

**Core endpoint groups:**
- **Authentication** - Login/logout with username/password, session management
- **User Management** - Admin-only endpoints for creating/updating/deleting users
- **Settings** - Configure which company is "ours" for highlighting
- **Companies** - CRUD operations for competitor businesses
- **Company Groups** - Manage named collections of companies
- **Reviews** - Import initial data, trigger manual refresh per company
- **Comparisons** - Fetch ranked comparison data by service filter or named group
- **Snapshots** - Access historical point-in-time comparisons
- **Export** - Generate PDF reports from comparison data
- **Cron** - Internal endpoint for weekly automated refresh

> **Technical implementation:** See CLAUDE.md for complete REST API specification

---

### 6.3 Data Flow

**Initial Setup Flow:**
1. User logs in with credentials
2. User manually extracts reviews for 20 companies via browser console script
3. User imports JSON files via UI
4. System creates company records from imported data
5. User marks "Stash + Lode Storage" as our company in Settings
6. User optionally creates named groups (e.g., "Primary Competitors")
7. System calculates metrics and displays initial comparison

**Weekly Automated Update Flow:**
1. Scheduled job triggers weekly refresh
2. System scrapes recent reviews for each company (10-20 newest)
3. New reviews are identified and stored (deduplication by review ID)
4. Metrics are recalculated for each company
5. Results logged for monitoring

**Monthly Review Flow:**
1. User logs in and selects comparison type (service filter OR named group)
2. Comparison view loads with current data (from last weekly refresh)
3. User reviews rankings and metrics, can switch between different groupings
4. User clicks "Export PDF"
5. System auto-saves snapshot with comparison name
6. PDF generates and downloads for team presentation

> **Technical implementation:** See CLAUDE.md for detailed scraping logic and API flows

---

## 7. User Flows

### 7.1 Initial Setup

```
1. Visit app URL
   ↓
2. Login with username and password
   ↓
3. First-time setup prompt
   ↓
4. Go to Settings → Select "Stash + Lode Storage" from imported companies as our company
   ↓
5. Redirected to Dashboard (empty state)
```

### 7.2 Import Companies & Initial Data Collection

```
1. Navigate to "Import" page
   ↓
2. Instructions shown: "Extract reviews for each company using browser console script"
   ↓
3. User manually extracts reviews for each competitor (~2-3 min per company)
   ↓
4. User uploads JSON files for each company
   ↓
5. System creates company records and stores reviews
   ↓
6. User edits each company to set service type tags (Removals, Self-Storage, etc.)
   ↓
7. User optionally creates named groups (e.g., "Primary Competitors")
   ↓
8. Navigate to Comparison View → select filter or group to see rankings
```

### 7.3 Monthly Competitive Review

```
1. User logs in
   ↓
2. Comparison view loads with all companies (data from last weekly refresh)
   ↓
3. User selects filter (e.g., "Self-Storage Only") or named group from dropdown
   ↓
4. User reviews Stash + Lode's position and metrics
   ↓
5. User clicks "Export PDF"
   ↓
6. PDF generates and downloads
   ↓
7. User presents PDF in team meeting
```

### 7.4 View Historical Changes

```
1. In Comparison View
   ↓
2. Click "View History" or date dropdown
   ↓
3. List of snapshots by date shown
   ↓
4. User selects previous month
   ↓
5. Comparison view updates to show historical snapshot
   ↓
6. User compares current vs previous rankings
```

---

## 8. Design Requirements

### 8.1 Visual Design Principles

- **Clarity:** Rankings and metrics are immediately obvious
- **Efficiency:** Minimal clicks to perform key tasks
- **Professional:** Clean, corporate-friendly appearance
- **Data-Focused:** Emphasize numbers and trends over decoration

### 8.2 Visual Hierarchy

- **Stash + Lode:** Highlighted with soft background color (light blue or yellow) throughout
- **Top 3 Companies:** Subtle badge or border (don't overpower own company highlight)
- **Positive Trends:** Green arrows/text
- **Negative Trends:** Red arrows/text
- **Neutral/Stable:** Gray

### 8.3 Responsive Design

- Mobile-friendly (tablet and phone)
- Table converts to card layout on mobile
- All interactions work on touch devices

---

## 9. Non-Functional Requirements

### 9.1 Performance
- Comparison view loads within 10 seconds
- PDF generation completes within 30 seconds
- Weekly refresh completes within 1 hour (for all companies)

### 9.2 Reliability
- 99% uptime for web application
- Weekly refresh success rate >95%
- Graceful degradation if scraping fails (manual fallback)

### 9.3 Security
- Password hashed with bcrypt
- HTTPS for all traffic
- Session expiration after 7 days
- Input validation on all user inputs
- No sensitive data logged

### 9.4 Cost Optimization
- Target: $0/month for data collection (web scraping)
- Hosting: Railway container (<$20/month)
- Database: SQLite on disk (no separate DB cost)
- **Total Target:** <$50/month

### 9.5 Maintainability
- Google Maps DOM selectors documented and easy to update
- Clear logging for cron job failures
- Manual fallback process documented for team

---

## 10. Constraints & Assumptions

### 10.1 Constraints

**Technical:**
- Web scraping violates Google's TOS (acceptable risk for internal low-volume use)
- Scraping is fragile (DOM changes will break scripts)
- Review dates are approximate ("2 weeks ago" not precise timestamps)

**Business:**
- Single city/metro area (not multi-market)
- Internal tool only (no external users)
- Small team (2-5 people)

**Timeline:**
- 1-2 week MVP timeline limits scope
- Must prioritize core features

### 10.2 Assumptions

- All competitor businesses have Google Maps listings with reviews
- Competitors have <250 reviews (low volume)
- Monthly comparison cadence is sufficient
- Team is comfortable with semi-manual initial data collection
- Individual user accounts with role-based access are sufficient for security
- Weekly data refresh is sufficient (not daily)
- Team members have access to browser DevTools

---

## 11. Out of Scope (MVP)

**Deferred to V2:**
- Timeline/chart visualization of ranking changes
- Branded PDF exports with logo
- Email alerts for ranking changes
- Advanced filtering (by date range, rating range)
- Sentiment analysis
- Multi-city/regional comparisons

**Explicitly Not Planned:**
- Real-time monitoring (weekly refresh only)
- Review response management
- Integration with other review platforms (Yelp, etc.)
- Public-facing features
- Customer-facing features
- Mobile native app

---

## 12. Success Criteria

### 12.1 MVP Launch Criteria

**Functional:**
- [ ] User can log in with username and password
- [ ] User can set Stash + Lode as "our company" in settings
- [ ] User can import 11-20 companies from review JSON files
- [ ] User can tag companies with service type
- [ ] User can extract reviews via browser console script
- [ ] User can import review JSON files
- [ ] System calculates all 6 metrics correctly
- [ ] Comparison view displays ranked companies
- [ ] Stash + Lode is visually highlighted
- [ ] User can filter by service type
- [ ] User can export comparison to PDF
- [ ] Weekly automated refresh works
- [ ] User can view historical snapshots

**Quality:**
- [ ] No critical bugs
- [ ] Comparison loads within 10 seconds
- [ ] Mobile responsive
- [ ] Costs <$50/month
- [ ] Password stored securely

### 12.2 Post-Launch Success (3 Months)

**Usage:**
- Team performs monthly comparisons consistently
- Weekly refresh runs successfully >95% of time
- Team finds insights valuable for decision-making

**Technical:**
- Scraping continues to work (or manual fallback is acceptable)
- 99% uptime maintained
- Costs remain <$50/month

---

## 13. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Google blocks/detects scraping | High | Medium | Use stealth plugin, human-like delays; Manual console extraction as fallback |
| Google Maps UI changes break selectors | Medium | High | Document selectors clearly; Quick update process; Manual extraction always works |
| 1-2 week timeline too aggressive | Medium | Medium | Prioritize core features ruthlessly; Defer nice-to-haves to V2 |
| Review date parsing is inaccurate | Low | Medium | Use approximate dates ("2 weeks ago"); Good enough for 3-month trend |
| Weekly refresh fails | Medium | Low | Email notifications; Manual refresh button; Acceptable to skip one week |

---

## 14. Open Questions

1. **Review Date Parsing:** How to handle approximate dates like "2 weeks ago"?
   - **Decision:** Best-effort parse; accuracy not critical for 3-month trends

2. **City/Metro Bounds:** How to restrict company search to local area?
   - **Decision:** Not critical for MVP; team knows which competitors to add

3. **PDF Branding:** Include Stash + Lode logo in V2?
   - **Decision:** Defer to V2

4. **Named Groups:** How many groups will team realistically use?
   - **Assumption:** 1-3 groups (e.g., "Primary Competitors", "Melbourne Top 20") plus service-type filters

---

## 15. Appendix

### 15.1 Key Terminology

- **Calculated Average:** Precise average rating from individual reviews (not Google's rounded rating)
- **Rating Distribution:** Percentage breakdown of 5★/4★/3★/2★/1★ reviews
- **Recent Trend:** Comparison of last 3 months' average vs overall average
- **Review Velocity:** Number of new reviews per month
- **Response Rate:** Percentage of reviews with business response
- **Company Group:** Named collection of companies for custom comparisons (e.g., "Primary Competitors")
- **Comparison Snapshot:** Point-in-time view of rankings and metrics

### 15.2 Related Resources

- Express Documentation: https://expressjs.com/
- Prisma Documentation: https://www.prisma.io/docs
- Puppeteer Documentation: https://pptr.dev/
- Tailwind CSS: https://tailwindcss.com/docs
- Railway Documentation: https://docs.railway.com/

---

**Document Prepared By:** Claude (AI Assistant) with input from Stash + Lode Storage team
**Next Steps:** Review PRD, finalize technical decisions, begin development
