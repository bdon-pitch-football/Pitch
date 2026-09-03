// Simple in-memory sliding-window rate limiter, per serverless instance.
// Good enough for a scraped waitlist form (doc 29 §4): each warm instance
// enforces the cap independently, and a cold-start burst is still bounded by
// the unique-email index. No third-party service — boring wins.

const hits = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 10;

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  // Bound memory: drop stale keys occasionally.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}
