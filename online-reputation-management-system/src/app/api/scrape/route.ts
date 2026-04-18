import { spawn } from 'node:child_process';

import { bgTriggerCinema, getJobStatus, SyncProgress } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

// Polling interval in ms
const POLL_INTERVAL = 3000;
const PROJECT_ROOT = 'E:\\NextJS\\persional_project\\lotte_gg_map';
const PYTHON_CRAWLER_DIR = `${PROJECT_ROOT}\\google-review-craw`;
const PYTHON_EXECUTABLE = `${PYTHON_CRAWLER_DIR}\\.venv\\Scripts\\python.exe`;

function normalizeLogMessage(chunk: string) {
  return chunk.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
}

async function runSyncAllForeground(send: (p: SyncProgress) => void) {
  send({ cinema: 'System', status: 'loading', message: 'Đang mở browser Selenium và chạy sync foreground...' });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      PYTHON_EXECUTABLE,
      ['start.py', 'scrape', '--config', 'config.yaml', '--headed'],
      {
        cwd: PYTHON_CRAWLER_DIR,
        detached: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const flushBuffer = (buffer: string, cinema: string, status: SyncProgress['status']) => {
      const lines = normalizeLogMessage(buffer);
      lines.forEach((line) => send({ cinema, status, message: line }));
    };

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      lines.map((line) => line.trim()).filter(Boolean).forEach((line) => {
        send({ cinema: 'Scraper', status: 'loading', message: line });
      });
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? '';
      lines.map((line) => line.trim()).filter(Boolean).forEach((line) => {
        send({ cinema: 'Browser', status: 'loading', message: line });
      });
    });

    child.on('error', (error) => {
      reject(new Error(`Không mở được browser foreground: ${error.message}`));
    });

    child.on('close', (code) => {
      flushBuffer(stdoutBuffer, 'Scraper', 'loading');
      flushBuffer(stderrBuffer, 'Browser', code === 0 ? 'loading' : 'error');

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Sync All foreground thất bại với mã thoát ${code ?? 'unknown'}`));
    });
  });
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const { cinemas, officialOnly } = await req.json().catch(() => ({ cinemas: [], officialOnly: false }));

  const stream = new ReadableStream({
    async start(controller) {
      const send = (p: SyncProgress) => {
        controller.enqueue(encoder.encode(JSON.stringify(p) + '\n'));
      };

      try {
        const targets = cinemas && cinemas.length > 0 ? cinemas : [{ url: null, name: 'Tất cả' }];

        if (targets.length === 1 && !targets[0]?.url) {
          await runSyncAllForeground(send);

          send({ cinema: 'System', status: 'loading', message: 'Đang tổng hợp dữ liệu thống kê...' });
          const { runMetricsAggregation } = await import('@/lib/metrics');
          await runMetricsAggregation((p) => send(p));
          send({ cinema: 'System', status: 'success', message: 'Sync All foreground đã hoàn tất.' });
          controller.close();
          return;
        }
        
        let pendingJobIds: { jobId: string, name: string }[] = [];
        let totalJobs = 0;
        let completedJobs = 0;
        let failedJobs = 0;

        // 1. Trigger jobs
        for (const target of targets) {
          const cinemaName = target.name || 'Unknown';
          const actionMsg = officialOnly ? 'Đang đồng bộ snapshot official + captured...' : 'Đang đặt lịch cào dữ liệu...';
          send({ cinema: cinemaName, status: 'loading', message: actionMsg });
          
          if (!target.url) {
            throw new Error('Sync All chỉ hỗ trợ foreground visible flow trong route này.');
          } else {
            // trigger single with potential officialOnly flag
            const res = await bgTriggerCinema(target.url, {
              ...(officialOnly ? { official_only: true } : {}),
              placeId: target.id || target.placeId,
              placeName: target.name,
            });
            const jobId = res.jobId;
            if (jobId) {
              pendingJobIds.push({ jobId, name: cinemaName });
              totalJobs += 1;
              send({ cinema: 'System', status: 'loading', message: `Đã tạo job ${totalJobs}/${Math.max(totalJobs, 1)}: ${cinemaName}` });
            }
          }
        }

        // 2. Poll jobs until completion
        while (pendingJobIds.length > 0) {
          const checkJobIds = [...pendingJobIds];
          pendingJobIds = []; // clear and only add back unfinished ones

          for (const job of checkJobIds) {
            try {
              const statusRes = await getJobStatus(job.jobId);
              const currentStatus = statusRes.status; // pending, running, completed, failed, cancelled
              
              if (currentStatus === 'completed') {
                 completedJobs += 1;
                 const reviewCount = statusRes.reviews_count || statusRes.reviewsSynced || 0;
                 send({ cinema: job.name, status: 'success', message: `Hoàn tất (đồng bộ ${reviewCount} reviews)` });
                 send({ cinema: 'System', status: 'loading', message: `Tiến độ Sync: ${completedJobs + failedJobs}/${Math.max(totalJobs, 1)} jobs` });
              } else if (currentStatus === 'failed' || currentStatus === 'cancelled') {
                 failedJobs += 1;
                 send({ cinema: job.name, status: 'error', message: `Lỗi: ${statusRes.error_message || 'Đã bị huỷ'}` });
                 send({ cinema: 'System', status: 'loading', message: `Tiến độ Sync: ${completedJobs + failedJobs}/${Math.max(totalJobs, 1)} jobs (${failedJobs} lỗi)` });
              } else {
                 // still running or pending
                 let msg = currentStatus === 'running' ? 'Đang thực thi...' : 'Đang đợi tới lượt...';
                 if (statusRes.progress && (statusRes.progress.phase || statusRes.progress.stage || statusRes.progress.message)) {
                     msg += ` (${statusRes.progress.phase || statusRes.progress.stage || statusRes.progress.message})`;
                 }
                 send({ cinema: job.name, status: 'loading', message: msg, jobId: job.jobId });
                 pendingJobIds.push(job);
              }
            } catch (err) {
              console.error(`Failed to poll status for job ${job.jobId}`, err);
              send({ cinema: job.name, status: 'error', message: `Lỗi kiểm tra tiến trình` });
              // We drop it from pendingJobIds to avoid infinite loop on broken job
            }
          }

          if (pendingJobIds.length > 0) {
             // Wait before next polling
             await new Promise(r => setTimeout(r, POLL_INTERVAL));
          }
        }

        // 3. Tính lại metrics từ dữ liệu mới
        send({ cinema: 'System', status: 'loading', message: `Đã xong job crawl (${completedJobs} thành công, ${failedJobs} lỗi). Đang tổng hợp dữ liệu thống kê...` });
        const { runMetricsAggregation } = await import('@/lib/metrics');
        await runMetricsAggregation((p) => send(p));

        send({ cinema: 'System', status: 'success', message: 'Tất cả các phiên đồng bộ đã hoàn tất!' });
        controller.close();

      } catch (err) {
        const error = err as Error;
        console.error('[/api/scrape] Error:', error.message);
        controller.enqueue(
          encoder.encode(JSON.stringify({
            cinema: 'System',
            status: 'error',
            message: error.message
          }) + '\n')
        );
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    }
  });
}
