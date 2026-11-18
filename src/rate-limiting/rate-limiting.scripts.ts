import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "scripts",
);

export const FIXED_WINDOW_SCRIPT = readFileSync(
  join(scriptsDir, "fixed-window.lua"),
  "utf8",
);
export const SLIDING_WINDOW_LOG_SCRIPT = readFileSync(
  join(scriptsDir, "sliding-window-log.lua"),
  "utf8",
);
export const SLIDING_WINDOW_COUNTER_SCRIPT = readFileSync(
  join(scriptsDir, "sliding-window-counter.lua"),
  "utf8",
);
export const IP_USER_RATE_LIMIT_SCRIPT = readFileSync(
  join(scriptsDir, "ip-user-rate-limit.lua"),
  "utf8",
);
