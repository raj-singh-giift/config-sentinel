// Sample app — intentionally uses some missing config keys for testing
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const config: any

const dbHost = config.db.host        // ✅ exists (via accessor config.db)
const dbPass = config.db.password    // ❌ MISSING — not in database.js
const secret = process.env.DB_PASSWORD        // ❌ MISSING — not in .env
const redisCluster = config.redis.cluster  // ❌ MISSING — not in redis.config.ts
const redisHost = config.redis.host  // ✅ exists

export { dbHost, dbPass, secret, redisCluster, redisHost }
