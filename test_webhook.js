const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const bodyObj = {
    "destination": "Uxxx",
    "events": [
        {
            "type": "follow",
            "mode": "active",
            "timestamp": Date.now(),
            "source": { "type": "user", "userId": "U4af4980629dummy123456" },
            "replyToken": "dummy_token"
        }
    ]
};
const bodyStr = JSON.stringify(bodyObj);
const signature = crypto.createHmac('SHA256', process.env.LINE_CHANNEL_SECRET).update(bodyStr).digest('base64');

const options = {
    hostname: 'musesoniawedding.zeabur.app',
    port: 443,
    path: '/webhook',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signature,
        'Content-Length': Buffer.byteLength(bodyStr)
    }
};

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', d => process.stdout.write(d));
});
req.on('error', e => console.error(e));
req.write(bodyStr);
req.end();
