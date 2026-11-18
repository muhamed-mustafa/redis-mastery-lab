local ipCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local userCount = tonumber(redis.call("GET", KEYS[2]) or "0")

local ipLimit = tonumber(ARGV[1])
local userLimit = tonumber(ARGV[2])

if ipCount >= ipLimit or userCount >= userLimit then
  return 0
end

local currentIpCount = redis.call("INCR", KEYS[1])
local currentUserCount = redis.call("INCR", KEYS[2])

local ttl = tonumber(ARGV[3])

if currentIpCount == 1 then
  redis.call("PEXPIRE", KEYS[1], ttl)
end

if currentUserCount == 1 then
  redis.call("PEXPIRE", KEYS[2], ttl)
end

return 1
