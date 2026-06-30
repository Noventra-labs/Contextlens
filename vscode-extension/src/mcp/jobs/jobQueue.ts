/**
 * MCP Job Queue
 *
 * Background job processing for expensive operations:
 * repository indexing, embeddings, explain-diff, AI summaries.
 */

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum JobType {
  REPO_INDEX = 'repo_index',
  EMBEDDINGS = 'embeddings',
  EXPLAIN_DIFF = 'explain_diff',
  AI_SUMMARY = 'ai_summary',
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number; // 0-100
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
  metadata: Record<string, any>;
}

type JobHandler = (job: Job) => Promise<any>;

export class JobQueue {
  private static instance: JobQueue;
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private queue: string[] = [];
  private running: boolean = false;
  private concurrency: number = 2;
  private activeCount: number = 0;
  private jobCounter: number = 0;

  private constructor() {}

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  /**
   * Register handler for job type.
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a new job.
   */
  enqueue(type: JobType, metadata: Record<string, any> = {}): string {
    const id = `job-${++this.jobCounter}-${Date.now()}`;
    const job: Job = {
      id,
      type,
      status: JobStatus.PENDING,
      progress: 0,
      createdAt: Date.now(),
      metadata,
    };

    this.jobs.set(id, job);
    this.queue.push(id);
    this.processNext();
    return id;
  }

  /**
   * Process next job in queue.
   */
  private async processNext(): Promise<void> {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) return;

    const jobId = this.queue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = JobStatus.FAILED;
      job.error = `No handler registered for job type: ${job.type}`;
      return;
    }

    this.activeCount++;
    job.status = JobStatus.RUNNING;
    job.startedAt = Date.now();

    try {
      job.result = await handler(job);
      job.status = JobStatus.COMPLETED;
      job.progress = 100;
    } catch (err: any) {
      job.status = JobStatus.FAILED;
      job.error = err.message;
    } finally {
      job.completedAt = Date.now();
      this.activeCount--;
      this.processNext();
    }
  }

  /**
   * Get job status.
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Cancel a pending job.
   */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== JobStatus.PENDING) return false;
    job.status = JobStatus.CANCELLED;
    this.queue = this.queue.filter(jid => jid !== id);
    return true;
  }

  /**
   * List jobs by status.
   */
  listJobs(status?: JobStatus): Job[] {
    const jobs = Array.from(this.jobs.values());
    if (status) return jobs.filter(j => j.status === status);
    return jobs;
  }

  /**
   * Update job progress (called by handler).
   */
  updateProgress(id: string, progress: number): void {
    const job = this.jobs.get(id);
    if (job) job.progress = Math.min(100, Math.max(0, progress));
  }

  /**
   * Get queue stats.
   */
  getStats(): { pending: number; running: number; completed: number; failed: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
      running: jobs.filter(j => j.status === JobStatus.RUNNING).length,
      completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter(j => j.status === JobStatus.FAILED).length,
    };
  }

  /**
   * Clean up completed/failed jobs older than maxAge.
   */
  cleanup(maxAgeMs: number = 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    for (const [id, job] of this.jobs) {
      if ((job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
          job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
