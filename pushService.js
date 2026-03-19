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

        // 2. Parse LINE UIDs and Names
        const pushList = [];
        const uidSet = new Set(); // to prevent duplicates

        // Extract from raw text input (Format: UID, Name)
        if (uidText) {
            const lines = uidText.split('\n');
            for (const line of lines) {
                const uidMatch = line.match(/U[a-f0-9]{32}/);
                if (uidMatch) {
                    const uid = uidMatch[0];
                    // The rest of the line (excluding the UID and formatting characters) is the name
                    let name = line.replace(uid, '').replace(/[,;\t]/g, ' ').trim();
                    if (!uidSet.has(uid)) {
                        uidSet.add(uid);
                        pushList.push({ uid, name: name || '貴賓' });
                    }
                }
            }
        }

        // Extract from CSV
        if (csvPath) {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const records = parse(csvContent, { columns: false, skip_empty_lines: true });

            for (const row of records) {
                let uid = null;
                let nameStr = '';
                for (const cell of row) {
                    const val = (cell || '').trim();
                    if (!uid && val.startsWith('U') && val.length > 25) {
                        uid = val;
                    } else if (val) {
                        nameStr += val + ' ';
                    }
                }
                if (uid && !uidSet.has(uid)) {
                    uidSet.add(uid);
                    pushList.push({ uid, name: nameStr.trim() || '貴賓' });
                }
            }
        }

        if (pushList.length === 0) {
            return res.status(400).json({ error: 'No valid LINE UIDs found in the input.' });
        }

        // 3. Personalized Push loop (Using pushMessage for individualized payloads)
        let pushCount = 0;
        const CHUNK_SIZE = 10; // Batch promises to avoid spiking memory or rate limits
        for (let i = 0; i < pushList.length; i += CHUNK_SIZE) {
            const chunk = pushList.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(user => {
                // String replacement for {{Name}}
                let personalizedJson = jsonContent.replace(/\{\{Name\}\}/gi, user.name);

                let flexObj;
                try {
                    flexObj = JSON.parse(personalizedJson);
                } catch {
                    // Fallback to original JSON parsing if substitution broke structure
                    flexObj = JSON.parse(jsonContent);
                }

                const messagePayload = flexObj.type === 'flex'
                    ? flexObj
                    : { type: 'flex', altText: '您有一則新通知！', contents: flexObj };

                return client.pushMessage(user.uid, [messagePayload]).catch(err => {
                    console.error(`Failed to push to ${user.name} (${user.uid}):`, err.originalError?.response?.data || err.message);
                });
            });
            await Promise.all(promises);
            pushCount += chunk.length;
        }

        res.json({ success: true, message: `Successfully pushed personalized messages to ${pushCount} users.` });
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
