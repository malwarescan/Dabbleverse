#!/usr/bin/env node
/**
 * Start Next.js and the BullMQ worker in the same process tree.
 * Use this as the Railway (or single-process) start command so the worker runs
 * without needing a second service. Requires REDIS_URL and DATABASE_URL.
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Start worker in background (same env as this process)
const worker = spawn('pnpm', ['run', 'worker'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  detached: true,
});
worker.unref();

worker.on('error', (err) => {
  console.error('Worker failed to start:', err.message);
});
worker.on('exit', (code, signal) => {
  if (code != null && code !== 0) {
    console.error('Worker exited with code', code);
  }
});

// Start Next.js in foreground so Railway keeps the process alive
const next = spawn('npm', ['run', 'start'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
next.on('exit', (code, signal) => {
  process.exit(code ?? 0);
});
next.on('error', (err) => {
  console.error('Next.js failed to start:', err.message);
  process.exit(1);
});
