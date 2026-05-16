module.exports = {
  sources: [
    '.env',
    { type: 'js', path: 'config/database.js', accessor: 'config.db' },
    { type: 'ts', path: 'config/redis.config.ts', accessor: 'config.redis' },
    { type: 'json', path: 'config/app.json', accessor: 'config.app' },
  ],
  scan: ['src'],
  ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  rules: {
    missingKey: 'error',
    unusedKey: 'warn',
    secretInNonEnv: 'warn',
  },
}
