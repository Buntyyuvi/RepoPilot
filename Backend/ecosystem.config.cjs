// PM2 process manager config for RepoPilot Backend.
//
// Two processes are managed:
//   strata-api    : the Express API server (dist/index.js) — fork mode.
//   strata-worker : the BullMQ index worker (dist/worker.js) — fork mode.
//
// NOTE: exec_mode 'cluster' (the `-i max` multi-core feature) is NOT reliable
// on Windows (PM2 cluster mode has long-standing issues on win32). Fork mode
// still gives auto-restart, log management and memory caps, which is the
// main goal here. When deploying to a Linux server, switch the API app below
// to cluster mode (see the commented-out recipe) to spread requests across
// all CPU cores.
//
// IMPORTANT when running multiple API instances later (cluster mode or
// multiple servers): the in-memory rate limiter becomes per-process, so
// mount a Redis-backed store (rate-limit-redis) to keep caps global. The
// session store is already Postgres-backed and is safe across instances.

module.exports = {
  apps: [
    {
      name: 'strata-api',
      script: './dist/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      // Give the SIGINT graceful shutdown (draining HTTP + DB) room to finish
      // before PM2 force-kills.
      kill_timeout: 10000,
      restart_delay: 1000,
      windowsHide: true,
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      merge_logs: true
    },
    {
      name: 'strata-worker',
      script: './dist/worker.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      kill_timeout: 10000,
      restart_delay: 1000,
      windowsHide: true,
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-error.log',
      merge_logs: true
    }
  ]
};

// ---------------------------------------------------------------------------
// LINUX CLUSTER RECIPE (deployment target with a real OS multi-core story).
// Replace `exec_mode: 'fork'` / `instances: 1` in the strata-api block with:
//
//   exec_mode: 'cluster',
//   instances: 'max',        // one worker per CPU core
//   kill_timeout: 10000,
//   wait_ready: false,       // no custom ready signal; PM2 probes the port
//
// Then swap the in-memory rate limiter for a Redis-backed store
// (rate-limit-redis) so the per-IP caps stay GLOBAL across cluster workers.
// The session store (connect-pg-simple) and BullMQ worker already scale
// across processes with no code changes.
// ---------------------------------------------------------------------------