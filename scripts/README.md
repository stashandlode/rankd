# Rankd Data Collection Scripts

This directory contains scripts for collecting Google Maps review data for Rankd.

## Scripts Overview

### 1. `extract-reviews-console.js` - Browser Console Extraction (Initial Data Dump)

**Use Case:** Initial one-time data collection for all 20 competitors

**Estimated Time:** 2-3 minutes per company, ~30-60 minutes for 20 companies

**Steps:**

1. **Open Google Maps**
   - Go to https://www.google.com/maps

2. **Search for Company**
   - Type the company name in the search box
   - Click on the correct business from results

3. **Open Reviews**
   - Click on the "Reviews" section/tab
   - Optional: Sort by "Newest" using the sort dropdown

4. **Load All Reviews**
   - Scroll down to the bottom of the reviews list
   - Keep scrolling until no more reviews load
   - You'll know you've reached the end when scrolling doesn't load new reviews
   - For ~250 reviews, this takes 30-60 seconds

5. **Open DevTools**
   - Press `F12` (Windows/Linux)
   - Or `Cmd + Option + I` (Mac)
   - Or right-click anywhere and select "Inspect"

6. **Go to Console Tab**
   - Click on the "Console" tab in DevTools

7. **Run Extraction Script**
   - Open `extract-reviews-console.js` in a text editor
   - Copy the entire contents
   - Paste into the console
   - Press Enter

8. **Download Results**
   - The script will automatically download a JSON file
   - File name format: `rankd-reviews-[company-name]-[timestamp].json`
   - Save this file for later import into Rankd

9. **Repeat for All Competitors**
   - Repeat steps 1-8 for each of the 20 companies

---

## Expected Output Format

The extracted JSON file will look like this:

```json
{
  "business": {
    "name": "Company Name Pty Ltd",
    "overallRating": 4.5,
    "totalReviews": 247,
    "placeId": "ChIJ...",
    "url": "https://www.google.com/maps/...",
    "extractedFrom": "Google Maps - Browser Console"
  },
  "metrics": {
    "calculatedAverage": 4.37,
    "totalExtracted": 235,
    "googleReviewCount": 247,
    "missingReviews": 12,
    "missingPercentage": 4.9
  },
  "reviews": [
    {
      "reviewId": "abc123xyz",
      "author": "John Smith",
      "rating": 5,
      "text": "Great service, highly recommend!",
      "dateText": "2 weeks ago",
      "hasBusinessResponse": true,
      "extractedAt": "2026-01-28T10:30:00.000Z"
    }
  ],
  "metadata": {
    "extractedAt": "2026-01-28T10:30:00.000Z",
    "extractionMethod": "browser-console",
    "version": "1.1"
  }
}
```

---

## Troubleshooting

### Script Returns "Could not find any reviews"

**Possible Causes:**
- You haven't scrolled to load reviews yet
- You're not on a business page with reviews
- Google Maps DOM structure has changed

**Solutions:**
1. Make sure reviews are visible on the page
2. Scroll down to load at least some reviews
3. Check that you're on the "Reviews" tab/section
4. If still failing, inspect a review element in DevTools to find the current selector

### Script Extracts Fewer Reviews Than Expected

**Possible Causes:**
- You didn't scroll all the way to the bottom
- Some reviews failed to load

**Solutions:**
1. Scroll more slowly to the bottom
2. Wait a few seconds between scrolls
3. Re-run the script after scrolling more

### Downloaded File is Empty or Invalid

**Possible Causes:**
- Browser blocked the download
- Script encountered an error

**Solutions:**
1. Check the console for error messages (red text)
2. Check browser download settings/permissions
3. Try running the script again after refreshing the page

### Google Maps Looks Different

**Issue:** Google Maps UI varies by region and device

**Solution:**
The script tries multiple selectors for individual fields (author, text, date). If it still fails:
1. Right-click on any review
2. Select "Inspect"
3. Find the parent `<div>` that wraps the entire review
4. Note the class names or data attributes
5. Update the review container selector (`div.jftiEf`) and field selectors in the script

---

## Updating Selectors (If Google Changes Their DOM)

If Google updates their UI and the script breaks, here's how to fix it:

1. **Find Review Container**
   - Right-click on a review → Inspect
   - Look for the parent `<div>` that contains the entire review
   - Note any `data-` attributes (e.g., `data-review-id`)
   - Note class names (e.g., `class="jftiEf"`)

2. **Update Script**
   - Open `extract-reviews-console.js`
   - Find the main review selector: `document.querySelectorAll('div.jftiEf')`
   - Replace `div.jftiEf` with the new selector class

3. **Update Individual Field Selectors**
   - Author name: Look for the element containing the reviewer's name
   - Rating: Look for `span[role="img"]` with aria-label
   - Review text: Look for the main text content
   - Date: Look for the date/time text
   - Business response: Look for owner response section

---

## Tips for Efficient Extraction

1. **Use a Second Monitor**
   - Keep instructions on one screen, Google Maps on another

2. **Create a Checklist**
   - List all 20 companies
   - Check them off as you complete extraction

3. **Organize Files**
   - Create a folder: `rankd-initial-data/`
   - Save all JSON files there
   - Use consistent naming

4. **Batch Processing**
   - Open multiple tabs with different companies
   - Pre-load and scroll all of them
   - Run extraction script on each tab sequentially

5. **Verify Data**
   - After extracting, open the JSON file
   - Check that `totalExtracted` matches expected review count
   - Spot-check a few reviews for accuracy

---

## Next Steps After Extraction

Once you've extracted reviews for all competitors:

1. **Organize Files**
   - Ensure all JSON files are in one folder
   - Verify each file is valid JSON

2. **Import into Rankd**
   - Log into Rankd application
   - Use the import feature to upload all JSON files

3. **Verify Import**
   - Check that all companies show correct review counts
   - Verify calculated averages match your expectations
   - Confirm Stash+Lode is highlighted

4. **Set Up Automated Updates**
   - The Puppeteer script will handle weekly incremental updates
   - This manual process is only needed once!

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the console output for specific error messages
3. Verify you've followed all steps correctly
4. Test with a different company to isolate the issue

Remember: This manual process is only needed once for initial data collection. Weekly updates will be automated via Puppeteer!
