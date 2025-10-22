module.exports = {
  apps: [
    {
      name: 'autocare-backend',
      script: 'venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8008 --reload',
      cwd: '/var/www/autocare/backend',
      interpreter: 'python3',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production'
      },
      output: '/var/www/autocare/backend/logs/backend.log',
      error: '/var/www/autocare/backend/logs/backend.log',
      merge_logs: true
    }
  ]
}
