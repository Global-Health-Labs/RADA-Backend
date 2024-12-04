module.exports = {
    apps : [{
      name: 'app',
      script: 'gunicorn',
      interpreter: 'python3',
      args: 'App:app -b 0.0.0.0:4000',
      exec_mode: 'fork', // or 'cluster' if you want to use multiple instances
      instances: 1, // adjust as needed
      autorestart: true,
      watch: false,
      max_memory_restart: '200M'
    }]
  };
  