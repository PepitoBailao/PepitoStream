module.exports = {
  apps: [
    {
      name: 'pepitostream-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs'],
    },
    {
      name: 'pepitostream-scraper',
      script: './dist/workers/scraperWorker.js',
      instances: 2,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/scraper-error.log',
      out_file: 'logs/scraper-out.log',
    },
    {
      name: 'pepitostream-verifier',
      script: './dist/workers/verifyWorker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/verifier-error.log',
      out_file: 'logs/verifier-out.log',
    },
  ],
};