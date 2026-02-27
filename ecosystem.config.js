module.exports = {
  apps: [{
    name: 'lite-backend',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    node_args: '--experimental-specifier-resolution=node',
    env: {
      NODE_ENV: 'production',
    },
    env_development: {
      NODE_ENV: 'development',
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'database', 'src/public/uploads'],
    max_restarts: 10,
    min_uptime: '10s',
  }],
};