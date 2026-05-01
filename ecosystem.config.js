module.exports = {
  apps: [
    {
      name: "diyseo",
      cwd: "/opt/diyseo",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3006
      },
      max_memory_restart: "512M",
      error_file: "/var/log/pm2/diyseo.err.log",
      out_file: "/var/log/pm2/diyseo.out.log",
      merge_logs: true
    },
    {
      name: "diyseo-auto-publish-worker",
      cwd: "/opt/diyseo",
      script: "npm",
      args: "run auto-publish:worker",
      env: {
        NODE_ENV: "production",
        PORT: 3006
      },
      max_memory_restart: "256M",
      error_file: "/var/log/pm2/diyseo-auto-publish-worker.err.log",
      out_file: "/var/log/pm2/diyseo-auto-publish-worker.out.log",
      merge_logs: true
    }
  ]
};
