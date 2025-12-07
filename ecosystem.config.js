// PM2 configuration for production deployment
module.exports = {
  apps: [
    {
      name: 'svattt-app',
      script: 'bun',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      restart_delay: 4000,
      max_restarts: 10,
    },
  ],
};
