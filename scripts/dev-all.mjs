import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

// Root "start everything" command. Runs:
//   1. Backend API server   (Backend/: npm run dev)
//   2. Backend index worker (Backend/: npm run dev:worker)
//   3. Frontend dev server  (Frontend/: npm run dev)
// Indexing needs both backend processes; the API enqueues jobs and the worker
// consumes them. If the worker is not running, jobs stay stuck at 0%.
const repoRoot = fileURLToPath(new URL("..", import.meta.url))
const backendDir = fileURLToPath(new URL("../Backend", import.meta.url))
const frontendDir = fileURLToPath(new URL("../Frontend", import.meta.url))

const jobs = [
  { label: "backend:all", cwd: backendDir, cmd: "npm", args: ["run", "dev:all"] },
  { label: "frontend", cwd: frontendDir, cmd: "npm", args: ["run", "dev"] },
]

const children = jobs.map(({ label, cwd, cmd, args }) => {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
    shell: process.platform === "win32",
  })
  child.on("exit", (code, signal) => {
    console.log(`[${label}] exited (${signal ?? code}). Stopping the rest.`)
    shutdown()
  })
  console.log(`[${label}] started`)
  return child
})

let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)