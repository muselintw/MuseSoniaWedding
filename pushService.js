const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { client } = require('./lineBot');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/push
// Accepts: csvFile (LINE UIDs), jsonFile (Flex Message JSON)
router.post('/push', upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'jsonFile', maxCount: 1 },
]), async (req, res) => {
    const csvPath = req.files?.['csvFile']?.[0]?.path;
    const jsonPath = req.files?.['jsonFile']?.[0]?.path;
    const uidText = req.body.uidText || '';
    const jsonText = req.body.jsonText || '';

    try {
        if ((!csvPath && !uidText.trim()) || (!jsonPath && !jsonText.trim())) {
            return res.status(400).json({ error: '請提供 推播名單 和 Flex JSON 模板。' });
        }

        // 1. Parse Flex Message JSON
        let jsonContent = jsonText.trim();
        if (!jsonContent && jsonPath) {
            jsonContent = fs.readFileSync(jsonPath, 'utf8');
        }

        let flexMessage;
        try {
            flexMessage = JSON.parse(jsonContent);
        } catch {
            return res.status(400).json({ error: 'Invalid JSON format in flex message string or file.' });
        }

        // Wrap in a proper flex message envelope if it's just the bubble/carousel
        const messagePayload = flexMessage.type === 'flex'
            ? flexMessage
            : { type: 'flex', altText: '您有一則新通知！', contents: flexMessage };

        // 2. Parse LINE UIDs
        const uidSet = new Set();

        // Extract from raw text input
        if (uidText) {
            const matches = uidText.match(/U[a-f0-9]{32}/g);
            if (matches) {
                matches.forEach(uid => uidSet.add(uid));
            }
        }

        // Extract from CSV
        if (csvPath) {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const records = parse(csvContent, { columns: false, skip_empty_lines: true });

            for (const row of records) {
                for (const cell of row) {
                    const val = (cell || '').trim();
                    if (val.startsWith('U') && val.length > 25) {
                        uidSet.add(val);
                    }
                }
            }
        }

        const uids = [...uidSet];
        if (uids.length === 0) {
            return res.status(400).json({ error: 'No valid LINE UIDs found in the CSV file.' });
        }

        // 3. Multicast in chunks of 500 (LINE API limit)
        const CHUNK_SIZE = 500;
        for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
            await client.multicast({
                to: uids.slice(i, i + CHUNK_SIZE),
                messages: [messagePayload],
            });
        }

        res.json({ success: true, message: `Successfully pushed to ${uids.length} users.` });
    } catch (err) {
        console.error('Push error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } finally {
        // Clean up temp uploads regardless of success/failure
        if (csvPath) try { fs.unlinkSync(csvPath); } catch {}
        if (jsonPath) try { fs.unlinkSync(jsonPath); } catch {}
    }
});

module.exports = router;
