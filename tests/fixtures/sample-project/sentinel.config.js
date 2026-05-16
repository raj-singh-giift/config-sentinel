module.exports = {
  sources: [
    { type: 'env', path: '.env' },
    { type: 'js', path: 'config/database.js', accessor: 'config.db' },
    { type: 'ts', path: 'config/redis.config.ts', accessor: 'config.redis' },
  ],
  scan: ['src'],
  rules: {
    missingKey: 'error',
    unusedKey: 'warn',
  },
}
