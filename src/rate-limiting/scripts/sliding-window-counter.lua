local previousCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local currentCount = tonumber(redis.call("GET", KEYS[2]) or "0")

local previousWindowWeight = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

local estimatedCount =
  previousCount * previousWindowWeight +
  currentCount

if estimatedCount >= limit then
  return 0
end

redis.call("INCR", KEYS[2])
redis.call("PEXPIRE", KEYS[2], ARGV[3])

return 1
