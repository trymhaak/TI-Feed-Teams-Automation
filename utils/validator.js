import { FeedValidator } from './validateFeeds.js';

/**
 * Adapter to provide a simple validateFeeds function expected by the
 * enhanced pipeline and config validator script.
 */
export function validateFeeds(feeds) {
  const validator = new FeedValidator();
  const result = validator.validateFeeds(feeds);
  return {
    isValid: result.errors.length === 0 && result.validCount > 0,
    errors: result.errors,
    validFeeds: result.validFeeds,
    totalFeeds: result.totalFeeds,
    validCount: result.validCount
  };
}

export default { validateFeeds };


