/**
 * This script runs `npx @convex-dev/auth` to help with setting up
 * environment variables for Convex Auth.
 *
 * You can safely delete it and remove it from package.json scripts.
 */

import fs from "fs";
import { config as loadEnvFile } from "dotenv";
import { spawnSync } from "child_process";

function markSetupRan() {
  fs.writeFileSync(".env.local", `
SETUP_SCRIPT_RAN=1
`, { flag: "a" });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isBackendReady() {
  const check = spawnSync("npx", ["convex", "env", "list"], {
    stdio: "pipe",
    encoding: "utf8",
  });
  return check.status === 0;
}

function waitForBackend(maxAttempts = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (isBackendReady()) {
      return true;
    }
    sleep(delayMs);
  }
  return false;
}

function hasAuthKeysConfigured() {
  const jwtCheck = spawnSync("npx", ["convex", "env", "get", "JWT_PRIVATE_KEY"], {
    stdio: "pipe",
    encoding: "utf8",
  });
  const jwksCheck = spawnSync("npx", ["convex", "env", "get", "JWKS"], {
    stdio: "pipe",
    encoding: "utf8",
  });

  const jwtKey = jwtCheck.status === 0 ? jwtCheck.stdout.trim() : "";
  const jwks = jwksCheck.status === 0 ? jwksCheck.stdout.trim() : "";

  return jwtKey.length > 0 && jwks.length > 0;
}

if (!fs.existsSync(".env.local")) {
  // Something is off, skip the script.
  process.exit(0);
}

const config = {};
loadEnvFile({ path: ".env.local", processEnv: config });

const runOnceWorkflow = process.argv.includes("--once");

if (runOnceWorkflow && config.SETUP_SCRIPT_RAN !== undefined) {
  // The script has already ran once, skip.
  process.exit(0);
}

if (!waitForBackend()) {
  console.warn("Skipping auth setup because local Convex backend is not ready yet.");
  process.exit(0);
}

if (hasAuthKeysConfigured()) {
  if (runOnceWorkflow) {
    markSetupRan();
  }
  process.exit(0);
}

const result = spawnSync("npx", ["@convex-dev/auth", "--skip-git-check"], {
  stdio: "inherit",
});

if (runOnceWorkflow && result.status === 0) {
  markSetupRan();
}


process.exit(result.status);