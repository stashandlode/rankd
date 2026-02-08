// Google Maps DOM selectors — fragile, update as needed
export const SELECTORS = {
  reviewContainer: 'div.jftiEf',
  reviewId: 'data-review-id',
  reviewRating: 'span.kvMYJc',
  reviewText: 'span.wiI7pd',
  reviewDate: 'span.rsqaWe',
  reviewAuthor: 'div.d4r55',
  businessResponse: 'div.CDe7pd',
  reviewSortButton: 'button[data-value="Sort"]',
  reviewSortNewest: 'div[data-index="1"]',
  reviewCount: 'div.fontBodySmall',
  scrollContainer: 'div.m6QErb.DxyBCb',
};

// Scraper timing
export const SCRAPER = {
  minDelay: 1000,
  maxDelay: 3000,
  scrollPause: 2000,
  consecutiveExistingThreshold: 5,
  maxScrollAttempts: 20,
};
