module.exports = {
    apps: [{
        name: "zeabur-monitor",
        script: "./monitor.js",
        watch: false,
        autorestart: true,
        max_memory_restart: "100M",
        env: {
            NODE_ENV: "production",
        }
    }]
};
