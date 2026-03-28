const https = require('https');
const { exec } = require('child_process');

// --- Configuration ---
const ZEABUR_URL = 'https://musesoniawedding.zeabur.app/';
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown between alerts
const IMESSAGE_TARGET = '987ksk987@gmail.com'; // User's Apple ID / iMessage target

// --- State ---
let lastAlertTime = 0;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ALERT = 2; // Trigger alert after 2 consecutive failures

function sendIMessage(message) {
    console.log(`[${new Date().toISOString()}] Sending iMessage alert...`);
    // Robust AppleScript command to send an iMessage
    // We explicitly find the iMessage service to prevent empty recipients
    const script = `osascript -e 'tell application "Messages"' -e 'set targetService to 1st service whose service type = iMessage' -e 'set targetBuddy to buddy "${IMESSAGE_TARGET}" of targetService' -e 'send "${message}" to targetBuddy' -e 'end tell'`;

    exec(script, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error sending iMessage: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`AppleScript stderror: ${stderr}`);
            return;
        }
        console.log(`iMessage sent successfully.`);
    });
}

function checkService() {
    console.log(`[${new Date().toISOString()}] Pinging ${ZEABUR_URL}...`);

    let isFinished = false;

    const req = https.get(ZEABUR_URL, (res) => {
        // Must consume data to free up memory/socket
        res.on('data', () => { });
        res.on('end', () => {
            isFinished = true;
            if (res.statusCode === 200) {
                console.log(`[${new Date().toISOString()}] Service is UP. (Status: ${res.statusCode})`);
                consecutiveFailures = 0; // Reset counter on success
            } else {
                handleFailure(`HTTP Status ${res.statusCode}`);
            }
        });
    });

    req.on('error', (err) => {
        if (!isFinished) {
            isFinished = true;
            handleFailure(`Network Error: ${err.message}`);
        }
    });

    req.setTimeout(10000, () => {
        if (!isFinished) {
            isFinished = true;
            req.abort();
            handleFailure(`Request Timed Out (10s)`);
        }
    });
}

function handleFailure(reason) {
    consecutiveFailures++;
    console.error(`[${new Date().toISOString()}] Service check FAILED (${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALERT}): ${reason}`);

    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
        const now = Date.now();
        if (now - lastAlertTime > COOLDOWN_MS) {
            const timeStr = new Date().toLocaleTimeString('zh-TW');
            const alertMsg = `⚠️ ZEABUR ALERT ⚠️\nYour LINE bot (musesoniawedding) is DOWN.\nReason: ${reason}\nTime: ${timeStr}`;

            sendIMessage(alertMsg);
            lastAlertTime = now; // Reset cooldown
        } else {
            console.log(`[${new Date().toISOString()}] Alert suppressed due to cooldown (${Math.round((COOLDOWN_MS - (now - lastAlertTime)) / 60000)} mins remaining).`);
        }
    }
}

// Ensure the script keeps running and check on startup
console.log(`[${new Date().toISOString()}] Starting Zeabur Monitoring Service...`);
// Initial check
checkService();
// Schedule periodic checks
setInterval(checkService, PING_INTERVAL_MS);
