const API_SERVER_URL = (process.env.API_SERVER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_KEY = process.env.NEXT_PUBLIC_CLOUD_RUN_API_KEY;
const PYTHON_START_CMD = 'cd /d E:\\NextJS\\persional_project\\lotte_gg_map\\google-review-craw && .venv\\Scripts\\python.exe api_server.py';

function buildApiBaseCandidates() {
  const base = API_SERVER_URL;
  const candidates = new Set<string>([base]);

  if (base.includes('localhost')) {
    candidates.add(base.replace('localhost', '127.0.0.1'));
  }
  if (base.includes('127.0.0.1')) {
    candidates.add(base.replace('127.0.0.1', 'localhost'));
  }

  return Array.from(candidates);
}

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

function normalizeFetchError(error: unknown) {
  const message = (error as Error)?.message || 'Unknown error';
  if (message.toLowerCase().includes('fetch failed')) {
    return `Không kết nối được Python API (${API_SERVER_URL}). Hãy mở terminal và chạy: ${PYTHON_START_CMD}`;
  }
  return message;
}

async function fetchWithFallback(path: string, init: RequestInit) {
  const bases = buildApiBaseCandidates();
  let lastError: unknown;

  for (const base of bases) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('fetch failed');
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
  try {
    const response = await fetchWithFallback('/trigger-all', {
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
  } catch (error) {
    throw new Error(normalizeFetchError(error));
  }
}

export async function bgTriggerCinema(
  url: string,
  overrides: Record<string, any> = {}
) {
  try {
    const response = await fetchWithFallback('/scrape', {
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
  } catch (error) {
    throw new Error(normalizeFetchError(error));
  }
}

export async function getJobStatus(jobId: string): Promise<PythonJobStatus> {
  try {
    const response = await fetchWithFallback(`/jobs/${encodeURIComponent(jobId)}`, {
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
  } catch (error) {
    throw new Error(normalizeFetchError(error));
  }
}
