const API_SERVER_URL = (process.env.API_SERVER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_KEY = process.env.NEXT_PUBLIC_CLOUD_RUN_API_KEY;

export type SyncProgress = {
  cinema: string;
  status: 'loading' | 'success' | 'error';
  message?: string;
  jobId?: string;
};

type TriggerAllResponse = {
  total_triggered: number;
  details: Array<{ url: string; job_id?: string; status?: string; error?: string }>;
};

type TriggerSingleResponse = {
  job_id?: string;
  status?: string;
  message?: string;
};

type PythonJobStatus = {
  status: string;
  error_message?: string;
  reviews_count?: number;
  reviewsSynced?: number;
  progress?: { phase?: string; stage?: string; message?: string };
};

function buildHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY && API_KEY !== 'your_api_key_here') {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Python API ${response.status}: ${text || response.statusText}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function bgTriggerAllCinemas() {
  const response = await fetch(`${API_SERVER_URL}/trigger-all`, {
    method: 'GET',
    headers: buildHeaders(),
    cache: 'no-store',
  });

  const data = await parseJson<TriggerAllResponse>(response);
  return {
    total_triggered: data.total_triggered || data.details?.length || 0,
    details: (data.details || []).map((item) => ({
      url: item.url,
      job_id: item.job_id,
      status: item.status || 'queued',
      error: item.error,
    })),
  };
}

export async function bgTriggerCinema(
  url: string,
  overrides: Record<string, any> = {}
) {
  const response = await fetch(`${API_SERVER_URL}/scrape`, {
    method: 'POST',
    headers: buildHeaders(),
    cache: 'no-store',
    body: JSON.stringify({
      url,
      official_only: Boolean(overrides.official_only),
    }),
  });

  const data = await parseJson<TriggerSingleResponse>(response);
  return {
    jobId: data.job_id,
    status: data.status || 'queued',
  };
}

export async function getJobStatus(jobId: string): Promise<PythonJobStatus> {
  const response = await fetch(`${API_SERVER_URL}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: buildHeaders(),
    cache: 'no-store',
  });

  const job = await parseJson<any>(response);
  return {
    status: job.status,
    error_message: job.error_message,
    reviews_count: job.reviews_count || 0,
    reviewsSynced: job.reviews_count || 0,
    progress: job.progress
      ? { stage: job.progress.stage, message: job.progress.message }
      : undefined,
  };
}
