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
    }
  ]
};
