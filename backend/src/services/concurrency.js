import os from 'node:os';
import { ApiError } from '../utils/ApiError.js';

/** Counting semaphore with a bounded waiting queue (protects CPU/RAM from a flood of heavy jobs). */
export class Semaphore {
  constructor(max, maxQueue) {
    this.max = max;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.queue = [];
  }

  get isFull() { return this.active >= this.max && this.queue.length >= this.maxQueue; }

  async acquire() {
    if (this.active < this.max) { this.active += 1; return; }
    if (this.queue.length >= this.maxQueue) {
      throw new ApiError(503, 'Our servers are busy right now. Please try again in a minute.', { code: 'SERVER_BUSY' });
    }
    await new Promise((resolve) => this.queue.push(resolve)); // the slot is handed over by release()
  }

  release() {
    const next = this.queue.shift();
    if (next) next(); else this.active -= 1;
  }

  async run(fn) {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
}

const cpus = Math.max(1, os.cpus().length);
export const cpuPool = new Semaphore(Math.max(2, cpus - 1), 30); // image + pdf work
export const videoPool = new Semaphore(Math.max(1, Math.min(2, Math.floor(cpus / 2))), 6); // ffmpeg encodes

// per-user active request counter
const active = new Map();
export function acquireUserSlot(userId, max) {
  const key = String(userId);
  const n = active.get(key) || 0;
  if (n >= max) return false;
  active.set(key, n + 1);
  return true;
}
export function releaseUserSlot(userId) {
  const key = String(userId);
  const n = (active.get(key) || 1) - 1;
  if (n <= 0) active.delete(key); else active.set(key, n);
}
