/**
 * scraper.ts
 *
 * Helper functions to communicate with Convex crawl jobs.
 */

import { convexAction, convexQuery } from '@/lib/convex';

export type SyncProgress = {
  cinema: string;
  status: 'loading' | 'success' | 'error';
  message?: string;
  jobId?: string;
};

export async function bgTriggerAllCinemas() {
  const places = await convexQuery<any[]>('places:list', {});
  const details: Array<{ url: string; job_id?: string; status: string; error?: string }> = [];

  for (const place of places) {
    try {
      const res = await convexAction<any>('crawlerActions:startCrawlJob', {
        placeId: place.placeId,
        placeName: place.name,
        url: place.originalUrl || place.resolvedUrl || `https://maps.google.com/?q=${encodeURIComponent(place.name)}`,
        officialOnly: false,
      });
      details.push({
        url: place.originalUrl || place.resolvedUrl || '',
        job_id: res?.jobId,
        status: res?.status || 'completed',
      });
    } catch (error) {
      const err = error as Error;
      details.push({
        url: place.originalUrl || place.resolvedUrl || '',
        status: 'failed',
        error: err.message,
      });
    }
  }

  return {
    total_triggered: details.length,
    details,
  };
}

export async function bgTriggerCinema(
  url: string,
  overrides: Record<string, any> = {}
) {
  const placeId = overrides.placeId || `manual-${Math.random().toString(36).slice(2, 10)}`;
  const placeName = overrides.placeName || overrides.name || `Cinema ${placeId.slice(-4)}`;

  return await convexAction('crawlerActions:startCrawlJob', {
    placeId,
    placeName,
    url,
    officialOnly: Boolean(overrides.official_only),
  });
}

export async function getJobStatus(jobId: string) {
  const job = await convexQuery<any>('crawlJobs:getByJobId', { jobId });
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  return {
    status: job.status,
    error_message: job.error,
    reviews_count: job.reviewsSynced || 0,
    reviewsSynced: job.reviewsSynced || 0,
    progress: job.message
      ? { phase: job.message, message: job.message }
      : undefined,
  };
}
