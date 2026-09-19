import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

// Runs both the API server (src/index.ts) and the indexing worker
// (src/worker.ts) from a single command. Indexing requires BOTH processes:
// the API enqueues jobs into the `repo-indexing` BullMQ queue and the worker
// consumes them. Without this, jobs stay in a "running" state forever with
// total: 0 and processed: 0.
const backendDir = fileURLToPath(new URL("..", import.meta.url))

const children = [
  spawn("npm", ["run", "dev"], {
    cwd: backendDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
  spawn("npm", ["run", "dev:worker"], {
    cwd: backendDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
]

let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

children.forEach((child) => child.on("exit", shutdown))
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.log(
  "\n[dev:all] Started API (tsx watch src/index.ts) + worker (tsx watch src/worker.ts). Press Ctrl+C to stop.\n",
)