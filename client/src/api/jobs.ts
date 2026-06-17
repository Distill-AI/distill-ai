import client from './client';
import type { JobType } from './interface/jobs';
import type { Status } from './interface/status';
import type { Priority } from './interface/priority';

export type { JobType, Status, Priority };

export interface Job {
  id: string;
  type: JobType;
  status: Status;
  priority: Priority;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface QueueStatus {
  paused: boolean;
  workers: number;
}

export async function fetchStats(): Promise<JobStats> {
  const res = await client.get<{ data: JobStats }>('/jobs/stats');
  return res.data.data;
}

export async function fetchQueueStatus(): Promise<QueueStatus> {
  const res = await client.get<{ data: QueueStatus }>('/jobs/queue/status');
  return res.data.data;
}

export async function pauseQueue(): Promise<void> {
  await client.post('/jobs/queue/pause');
}

export async function resumeQueue(): Promise<void> {
  await client.post('/jobs/queue/resume');
}
