import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false },
});

export interface DebounceJobData {
  pageId: string;
  psid: string;
  customerName?: string;
  gender?: string;
  extended?: boolean;
}

export const DEBOUNCE_QUEUE_NAME = 'adaptive-debounce';

export const debounceQueue = new Queue<DebounceJobData>(DEBOUNCE_QUEUE_NAME, {
  connection: { url: config.redisUrl },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  },
});
