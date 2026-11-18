export function buildRateLimitKey(
  prefix: string,
  identifier: string,
  windowId: number,
): string {
  return `rate-limit:${prefix}:${identifier}:${windowId}`;
}

export function getWindowId(now: number, windowMs: number): number {
  return Math.floor(now / windowMs);
}

export function getRemainingWindowMs(now: number, windowMs: number): number {
  return windowMs - (now % windowMs);
}
