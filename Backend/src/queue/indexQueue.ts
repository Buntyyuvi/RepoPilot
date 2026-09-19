import { Queue } from 'bullmq';

// Shared Redis connection settings for the queue (producer in the API server)
// and the worker process. Defaults match the local Docker Compose redis service.
export const redisConnection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

// The API server only ever adds jobs here — enqueuing returns instantly and
// the actual chunking/embedding happens inside the worker process.
export const indexQueue = new Queue('repo-indexing', {
  connection: redisConnection,
});