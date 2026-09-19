import dotenv from "dotenv";
import { Worker } from "bullmq";
import * as Sentry from "@sentry/node";
import { redisConnection } from "./queue/indexQueue";
import { runIndexing, type IndexingProgress } from "./services/indexing";
import { initializeSchema } from "./config/schema";
import { closeDatabase } from "./config/database";

dotenv.config({ quiet: true });

interface IndexJobData {
  userId: number;
  fullName: string;
  branch: string;
}

async function start(): Promise<void> {
  // Opt-in Sentry error tracking, mirroring the API server: active only when a
  // DSN is configured so local runs stay unaffected.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
    });
    console.log("Worker: Sentry error tracking enabled.");
  }

  try {
    await initializeSchema();
    console.log("Worker: database schema initialized.");
  } catch (error) {
    console.error("Worker: failed to initialize database schema:", error);
    process.exit(1);
  }

  // Two repositories can index in parallel. Chunking + embedding stays in this
  // process, so the API server's event loop is never blocked by this work.
  const worker = new Worker<IndexJobData>(
    "repo-indexing",
    async (job) => {
      const report = async (progress: IndexingProgress): Promise<void> => {
        await job.updateProgress(progress);
      };
      await runIndexing(
        job.data.userId,
        job.data.fullName,
        job.data.branch,
        report,
      );
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Indexing completed: ${job.data.fullName}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Indexing failed for ${job?.data.fullName ?? "unknown repo"}:`, error);
    if (Sentry.isEnabled()) {
      Sentry.captureException(error, {
        tags: { fullName: job?.data.fullName ?? "unknown" },
      });
    }
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log(`Worker: listening on repo-indexing queue (concurrency ${worker.concurrency}).`);

  process.on("SIGINT", () => void shutdown(worker, "SIGINT"));
  process.on("SIGTERM", () => void shutdown(worker, "SIGTERM"));
}

async function shutdown(worker: Worker<IndexJobData>, signal: string): Promise<void> {
  console.log(`Worker: received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("Worker: graceful shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await worker.close();

  try {
    await closeDatabase();
  } catch (error) {
    console.error("Worker: failed to close database pool:", error);
  }

  process.exit(0);
}

void start();