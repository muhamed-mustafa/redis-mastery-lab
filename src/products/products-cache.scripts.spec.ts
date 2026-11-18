import { describe, expect, it } from "vitest";
import { DELETE_CACHE_IF_LOCK_OWNED_SCRIPT } from "./products-cache.scripts.js";

describe("DELETE_CACHE_IF_LOCK_OWNED_SCRIPT", () => {
  const normalizedScript = DELETE_CACHE_IF_LOCK_OWNED_SCRIPT.replace(
    /\s+/g,
    " ",
  ).trim();

  it("checks ownership before deleting and returns 0 for a mismatched token", () => {
    expect(normalizedScript).toContain(
      'if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end',
    );
    expect(normalizedScript.indexOf("return 0")).toBeLessThan(
      normalizedScript.indexOf('redis.call("DEL", KEYS[2])'),
    );
  });

  it("returns 1 after deleting, regardless of whether the cache key existed", () => {
    expect(normalizedScript).toContain('redis.call("DEL", KEYS[2]) return 1');
    expect(normalizedScript).not.toContain("return redis.call(");
  });
});
