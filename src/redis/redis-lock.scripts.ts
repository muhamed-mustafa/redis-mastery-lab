export const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

export const RENEW_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

export const SET_CACHE_IF_LOCK_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
    return 1
  end

  return 0
`;

export const DELETE_CACHE_IF_LOCK_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[2])
  end

  return 0
`;
