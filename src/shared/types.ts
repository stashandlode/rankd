// Shared TypeScript types for Rankd

// API response envelope
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// User
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

// Company
export interface Company {
  placeId: string;
  name: string;
  url: string | null;
  isOurCompany: boolean;
  services: string[];
  createdAt: string;
}

// Review
export interface Review {
  reviewId: string;
  placeId: string;
  author: string | null;
  rating: number;
  reviewText: string | null;
  reviewDate: string | null;
  hasResponse: boolean;
  responseText: string | null;
  scrapedAt: string;
}

// Review Metadata
export interface ReviewMetadata {
  placeId: string;
  totalReviews: number | null;
  scrapedReviews: number | null;
  calculatedAvg: number | null;
  lastScraped: string | null;
}

// Rating distribution entry
export interface RatingBucket {
  count: number;
  percent: number;
}

// Company ranking in comparison view
export interface CompanyRanking {
  rank: number;
  placeId: string;
  name: string;
  url: string | null;
  isOurCompany: boolean;
  services: string[];
  calculatedAvg: number;
  reviewCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, RatingBucket>;
  recentTrend: number;
  reviewVelocity: number;
  responseRate: number;
}

// Company group
export interface CompanyGroup {
  id: number;
  name: string;
  companyIds: string[];
  createdAt: string;
}

// Comparison snapshot
export interface ComparisonSnapshot {
  id: number;
  comparisonName: string;
  rankings: CompanyRanking[];
  createdAt: string;
}

// Import format (from extraction script)
export interface ImportData {
  business: {
    name: string;
    overallRating: number;
    totalReviews: number;
    placeId: string;
    url: string;
  };
  reviews: ImportReview[];
  metadata: {
    extractedAt: string;
    extractionMethod?: string;
    version?: string;
  };
}

export interface ImportReview {
  reviewId: string;
  author: string;
  rating: number;
  text: string;
  dateText: string;
  hasBusinessResponse: boolean;
  extractedAt: string;
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface SessionUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
}
