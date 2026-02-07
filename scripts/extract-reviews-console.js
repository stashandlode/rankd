/**
 * Google Maps Review Extractor - Browser Console Script
 *
 * INSTRUCTIONS:
 * 1. Open Google Maps (https://www.google.com/maps)
 * 2. Search for the company name
 * 3. Click on the company to open its details panel
 * 4. Click on the "Reviews" tab/section
 * 5. Sort reviews by "Newest" (optional but recommended)
 * 6. Scroll down to the bottom to load ALL reviews
 *    - Keep scrolling until no more reviews load
 *    - For ~250 reviews, this should take 30-60 seconds
 * 7. Open DevTools (F12 or Cmd+Option+I on Mac)
 * 8. Go to Console tab
 * 9. Paste this entire script and press Enter
 * 10. The script will extract all reviews and download a JSON file
 *
 * TROUBLESHOOTING:
 * - If the script doesn't work, Google may have changed their DOM structure
 * - Check the selectors in the extractReviews() function below
 * - Use DevTools Inspector to find the correct element classes/attributes
 */

(function() {
  console.log('🚀 Starting Google Maps Review Extraction...');

  /**
   * Extract all reviews from the current Google Maps page
   */
  function extractReviews() {
    const reviews = [];

    // Select review elements using known working selector
    const reviewElements = document.querySelectorAll('div.jftiEf');

    if (!reviewElements || reviewElements.length === 0) {
      console.error('❌ Could not find any reviews.');
      console.log('💡 Make sure you\'re on the Reviews tab and have scrolled to load all reviews.');
      return null;
    }

    console.log(`📊 Found ${reviewElements.length} review elements`);
    console.log(`⏳ Processing reviews...`);

    const seenReviewIds = new Set();
    let skippedNoRating = 0;
    let skippedDuplicate = 0;
    let errors = 0;

    reviewElements.forEach((element, index) => {
      try {
        // Extract review data
        // Note: These selectors may need adjustment based on Google's current DOM structure

        // Author name - try multiple selectors
        const authorName =
          element.querySelector('.d4r55')?.textContent?.trim() ||
          element.querySelector('.WNxzHc')?.textContent?.trim() ||
          element.querySelector('[class*="reviewer"]')?.textContent?.trim() ||
          'Unknown Author';

        // Rating - look for aria-label with star rating
        const ratingElement = element.querySelector('span[role="img"]');
        const ratingText = ratingElement?.getAttribute('aria-label') || '';
        const ratingMatch = ratingText.match(/(\d+)/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;

        // Review text - try multiple selectors
        const reviewText =
          element.querySelector('.wiI7pd')?.textContent?.trim() ||
          element.querySelector('.MyEned')?.textContent?.trim() ||
          element.querySelector('[class*="review-text"]')?.textContent?.trim() ||
          element.querySelector('.rsqaWe')?.nextElementSibling?.textContent?.trim() ||
          '';

        // Date text
        const dateText =
          element.querySelector('.rsqaWe')?.textContent?.trim() ||
          element.querySelector('.DU9Pgb')?.textContent?.trim() ||
          element.querySelector('[class*="date"]')?.textContent?.trim() ||
          '';

        // Business response
        const hasResponse =
          element.querySelector('.CDe7pd') !== null ||
          element.querySelector('[class*="response"]') !== null ||
          element.textContent.includes('Response from the owner') ||
          element.textContent.includes('Response from');

        // Review ID (from data attribute or generate hash)
        const reviewId = element.getAttribute('data-review-id') ||
                        element.getAttribute('data-review-token') ||
                        `review-${createHash(authorName + dateText + reviewText)}`;

        // Check why we might skip this review
        if (rating === null) {
          skippedNoRating++;
          console.warn(`⚠️  Skipped review ${index + 1}: No rating found. Author: "${authorName}", Date: "${dateText}"`);
          return;
        }

        if (seenReviewIds.has(reviewId)) {
          skippedDuplicate++;
          return;
        }

        // Add the review
        seenReviewIds.add(reviewId);
        reviews.push({
          reviewId: reviewId,
          author: authorName,
          rating: rating,
          text: reviewText,
          dateText: dateText,
          hasBusinessResponse: hasResponse,
          extractedAt: new Date().toISOString()
        });

      } catch (error) {
        errors++;
        console.error(`⚠️  Error extracting review ${index + 1}:`, error.message, error.stack);
      }
    });

    console.log(`✓ Processed: ${reviewElements.length} elements`);
    console.log(`✓ Extracted: ${reviews.length} unique reviews`);
    if (skippedDuplicate > 0 || skippedNoRating > 0) {
      console.log(`✓ Skipped: ${skippedDuplicate} duplicates, ${skippedNoRating} without rating`);
    }
    if (errors > 0) {
      console.warn(`⚠️  Errors encountered: ${errors}`);
    }

    return reviews;
  }

  /**
   * Create a simple hash from a string (for review IDs)
   */
  function createHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get business information from the page
   */
  function getBusinessInfo() {
    // Business name - try to extract from URL first (most reliable)
    let businessName = 'Unknown Business';

    // Extract from URL (e.g., "/place/Stash%2BLode+Storage+and+Removals/")
    const urlMatch = window.location.pathname.match(/\/place\/([^/@]+)/);
    if (urlMatch && urlMatch[1]) {
      // Decode URL encoding: %2B = +, + = space, %20 = space
      businessName = decodeURIComponent(urlMatch[1])
        .replace(/\+/g, ' ')
        .trim();
      console.log(`✓ Business name extracted from URL: "${businessName}"`);
    } else {
      // Fallback: Try DOM selectors
      const nameSelectors = [
        'h1.DUwDvf',                           // Common class
        'h1[class*="fontHeadline"]',           // Headline class
        'div[role="main"] h1',                 // H1 in main content
        'h1.qrShPb',                           // Alternative class
        '[data-item-id] h1',                   // H1 with data attribute
        'h1',                                  // Any H1
      ];

      for (const selector of nameSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          businessName = element.textContent.trim();
          console.log(`✓ Business name found with selector: ${selector}`);
          break;
        }
      }

      if (businessName === 'Unknown Business') {
        console.warn('⚠️  Could not find business name in URL or DOM.');
      }
    }

    // Overall rating and review count - try multiple methods
    let overallRating = null;
    let totalReviews = null;

    // Method 1: Search all divs for "X reviews" text pattern (most reliable)
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent?.trim() || '';

      // Look for pattern: "223 reviews" or "1,234 reviews"
      const reviewMatch = text.match(/^(\d+(?:,\d+)?)\s+reviews?$/i);
      if (reviewMatch) {
        totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''));
        console.log(`✓ Review count found: ${totalReviews} (text match: "${text}")`);
        break;
      }
    }

    // Method 2: Try aria-labels and specific selectors as fallback
    if (!totalReviews) {
      const ratingSelectors = [
        'button[aria-label*="reviews"]',         // Reviews button/tab
        '[role="tablist"] button',               // Tab navigation
        'div[jsaction*="pane.rating"]',
        '[class*="rating"]',
      ];

      for (const selector of ratingSelectors) {
        const element = document.querySelector(selector);
        if (!element) continue;

        const text = element.textContent || element.getAttribute('aria-label') || '';

        // Try to find review count (e.g., "228 reviews" or "(228)")
        const countMatch = text.match(/(\d+(?:,\d+)?)\s*reviews?/i) ||
                          text.match(/\((\d+(?:,\d+)?)\)/);
        if (countMatch) {
          totalReviews = parseInt(countMatch[1].replace(/,/g, ''));
          console.log(`✓ Review count found: ${totalReviews} (selector: ${selector})`);
          break;
        }
      }
    }

    // Try to find overall rating from aria-labels
    const ratingElements = document.querySelectorAll('[aria-label*="star"]');
    for (const el of ratingElements) {
      const ariaLabel = el.getAttribute('aria-label') || '';
      const ratingMatch = ariaLabel.match(/(\d+\.?\d*)\s*star/i);
      if (ratingMatch) {
        overallRating = parseFloat(ratingMatch[1]);
        break;
      }
    }

    if (!totalReviews) {
      console.warn('⚠️  Could not determine total review count from page');
    }

    // Try to get place ID from URL or data attributes
    const url = window.location.href;
    const placeIdMatch = url.match(/!1s0x[a-f0-9]+:0x[a-f0-9]+|!3m1!1s(ChIJ[a-zA-Z0-9_-]+)/);
    const placeId = placeIdMatch ? placeIdMatch[0] : null;

    return {
      name: businessName,
      overallRating: overallRating,
      totalReviews: totalReviews,
      placeId: placeId,
      url: window.location.href,
      extractedFrom: 'Google Maps - Browser Console'
    };
  }

  /**
   * Download data as JSON file
   */
  function downloadJSON(filename, data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Format business name for filename
   */
  function sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Main execution
   */
  function main() {
    // Get business info
    const businessInfo = getBusinessInfo();

    // Extract reviews
    const reviews = extractReviews();

    if (!reviews || reviews.length === 0) {
      console.error('❌ Failed to extract reviews. Please check the troubleshooting steps above.');
      return;
    }

    // Calculate metrics for JSON export
    const totalStarsForExport = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRatingForExport = totalStarsForExport / reviews.length;

    const metrics = {
      calculatedAverage: parseFloat(avgRatingForExport.toFixed(2)),
      totalExtracted: reviews.length,
      googleReviewCount: businessInfo.totalReviews || null,
      missingReviews: businessInfo.totalReviews ? businessInfo.totalReviews - reviews.length : null,
      missingPercentage: businessInfo.totalReviews ?
        parseFloat(((businessInfo.totalReviews - reviews.length) / businessInfo.totalReviews * 100).toFixed(1)) : null,
    };

    // Add hypothetical ratings if there are missing reviews
    if (businessInfo.totalReviews && businessInfo.totalReviews > reviews.length) {
      const missing = businessInfo.totalReviews - reviews.length;

      const distribution = {
        5: reviews.filter(r => r.rating === 5).length,
        4: reviews.filter(r => r.rating === 4).length,
        3: reviews.filter(r => r.rating === 3).length,
        2: reviews.filter(r => r.rating === 2).length,
        1: reviews.filter(r => r.rating === 1).length,
      };

      let hypotheticalStars = 0;
      for (const [rating, count] of Object.entries(distribution)) {
        const proportion = count / reviews.length;
        const hypotheticalCount = proportion * missing;
        hypotheticalStars += parseInt(rating) * hypotheticalCount;
      }

      metrics.hypotheticalRating = parseFloat(((totalStarsForExport + hypotheticalStars) / businessInfo.totalReviews).toFixed(2));
      metrics.hypotheticalMaxRating = parseFloat(((totalStarsForExport + (missing * 5)) / businessInfo.totalReviews).toFixed(2));
    }

    // Create output data
    const outputData = {
      business: businessInfo,
      metrics: metrics,
      reviews: reviews,
      metadata: {
        extractedAt: new Date().toISOString(),
        extractionMethod: 'browser-console',
        version: '1.1'
      }
    };

    // ==================== SUMMARY ====================
    console.log('\n' + '═'.repeat(60));
    console.log(`📊 SUMMARY: ${businessInfo.name}`);
    console.log('═'.repeat(60));

    // Data completeness
    if (businessInfo.totalReviews && businessInfo.totalReviews > 0) {
      const missing = businessInfo.totalReviews - reviews.length;
      const missingPercent = (missing / businessInfo.totalReviews * 100).toFixed(1);

      console.log(`\n📈 Data Completeness:`);
      console.log(`   Google's Count:  ${businessInfo.totalReviews} reviews`);
      console.log(`   Extracted:       ${reviews.length} reviews`);

      if (missing > 0) {
        console.log(`   Missing:         ${missing} reviews (${missingPercent}%)`);
        console.log(`   Note: Google often doesn't load all reviews after scrolling`);
      } else if (missing < 0) {
        console.log(`   Note: Extracted ${Math.abs(missing)} more than Google's count`);
      } else {
        console.log(`   Status: ✓ All reviews captured (100%)`);
      }
    } else {
      console.log(`\n📈 Data Completeness:`);
      console.log(`   Extracted: ${reviews.length} reviews`);
    }

    // Rating breakdown
    console.log(`\n⭐ Rating Distribution:`);
    console.log(`   5★: ${reviews.filter(r => r.rating === 5).length.toString().padStart(3)} reviews`);
    console.log(`   4★: ${reviews.filter(r => r.rating === 4).length.toString().padStart(3)} reviews`);
    console.log(`   3★: ${reviews.filter(r => r.rating === 3).length.toString().padStart(3)} reviews`);
    console.log(`   2★: ${reviews.filter(r => r.rating === 2).length.toString().padStart(3)} reviews`);
    console.log(`   1★: ${reviews.filter(r => r.rating === 1).length.toString().padStart(3)} reviews`);

    // Business response rate
    const responseCount = reviews.filter(r => r.hasBusinessResponse).length;
    const responseRate = Math.round(responseCount / reviews.length * 100);
    console.log(`\n💬 Business Response Rate: ${responseCount}/${reviews.length} (${responseRate}%)`);

    // Calculate average
    const totalStars = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalStars / reviews.length;
    console.log(`\n✨ Calculated Average: ${avgRating.toFixed(2)} stars`);

    // Hypothetical ratings if we have missing reviews
    if (businessInfo.totalReviews && businessInfo.totalReviews > reviews.length) {
      const missing = businessInfo.totalReviews - reviews.length;

      // Distribution of extracted reviews
      const distribution = {
        5: reviews.filter(r => r.rating === 5).length,
        4: reviews.filter(r => r.rating === 4).length,
        3: reviews.filter(r => r.rating === 3).length,
        2: reviews.filter(r => r.rating === 2).length,
        1: reviews.filter(r => r.rating === 1).length,
      };

      // Hypothetical Rating: missing reviews follow same distribution
      let hypotheticalStars = 0;
      for (const [rating, count] of Object.entries(distribution)) {
        const proportion = count / reviews.length;
        const hypotheticalCount = proportion * missing;
        hypotheticalStars += parseInt(rating) * hypotheticalCount;
      }
      const hypotheticalRating = (totalStars + hypotheticalStars) / businessInfo.totalReviews;

      // Hypothetical Max Rating: all missing reviews are 5-star
      const hypotheticalMaxRating = (totalStars + (missing * 5)) / businessInfo.totalReviews;

      console.log(`\n🔮 Hypothetical Ratings (if ${missing} missing reviews were included):`);
      console.log(`   Same distribution: ${hypotheticalRating.toFixed(2)} stars`);
      console.log(`   All 5-star:        ${hypotheticalMaxRating.toFixed(2)} stars`);
    }

    console.log('\n' + '═'.repeat(60));

    // Download file
    const filename = `rankd-reviews-${sanitizeFilename(businessInfo.name)}-${Date.now()}.json`;
    downloadJSON(filename, outputData);

    console.log(`\n✅ SUCCESS! File downloaded: ${filename}`);

    return outputData;
  }

  // Run the extraction
  return main();
})();
