const line = require('@line/bot-sdk');
const supabase = require('./supabaseClient');
const { searchTable } = require('./tableService');

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
});

// LINE webhook signature verification middleware
const middleware = line.middleware(config);

async function handleEvent(event) {
    try {
        // ── Follow event: save new friend to DB ──────────────────────────────
        if (event.type === 'follow') {
            const userId = event.source.userId;

            let displayName = 'Unknown Guest';
            try {
                const profile = await client.getProfile(userId);
                displayName = profile.displayName;
            } catch (err) {
                console.error('Failed to get user profile:', err.message);
            }

            // Save to Supabase
            if (supabase) {
                const { error } = await supabase
                    .from('users')
                    .upsert(
                        [{ line_uid: userId, display_name: displayName, joined_at: new Date().toISOString() }],
                        { onConflict: 'line_uid' }
                    );

                if (error) {
                    console.error('Error saving user to Supabase:', error);
                } else {
                    console.log(`✅ User saved: ${displayName} (${userId})`);
                }
            } else {
                console.warn(`⚠️ Supabase not configured. Skipping DB save for ${displayName}.`);
            }

            return client.replyMessage({
                replyToken: event.replyToken,
                messages: [{
                    type: 'text',
                    text: `哈囉 ${displayName}！歡迎加入 Muse & Sonia 的婚禮！🎊\n\n若您要查詢桌次，請直接輸入您的「全名」來查詢喔！`,
                }],
            });
        }

        // ── Message event: table look-up ─────────────────────────────────────
        if (event.type === 'message' && event.message.type === 'text') {
            const guestName = event.message.text.trim();
            const tableInfo = searchTable(guestName);

            const replyText = tableInfo
                ? `親愛的 ${guestName}，您的桌次安排在：\n【${tableInfo}】`
                : `抱歉，目前找不到「${guestName}」的桌次資訊。\n請確認您輸入的是完整姓名；若仍有問題，請聯繫招待人員。`;

            return client.replyMessage({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: replyText }],
            });
        }

        return Promise.resolve(null);
    } catch (err) {
        console.error('Error handling event:', err);
        throw err;
    }
}

module.exports = { middleware, handleEvent, client };
