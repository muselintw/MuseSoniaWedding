const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// In-memory map: guest name → table name
const guestTableMap = new Map();

function loadTableData() {
    try {
        const csvPath = path.join(__dirname, '桌次_0319.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf8');

        const records = parse(fileContent, {
            skip_empty_lines: false,
            relax_column_count: true,
        });

        guestTableMap.clear();

        // CSV layout — simple two columns:
        // Column 0: Table Name (e.g. 主桌, 新娘親友1)
        // Column 1: Guest Name (e.g. 裴淑娥)
        
        // Skip the first header row if it's "座位表"
        let startIdx = 0;
        if (records.length > 0 && records[0][0] === '座位表') {
            startIdx = 1;
        }

        for (let i = startIdx; i < records.length; i++) {
            const row = records[i];
            if (row.length >= 2) {
                const table = (row[0] || '').trim();
                const name = (row[1] || '').trim();
                if (name && table) {
                    guestTableMap.set(name, table);
                }
            }
        }

        console.log(`✅ Loaded ${guestTableMap.size} guests from 桌次_0319.csv`);
    } catch (err) {
        console.error('❌ Error loading table data:', err);
    }
}

// Load once at startup
loadTableData();

/**
 * Returns the table name for a guest, or null if not found.
 * 1. Exact match
 * 2. Partial match (query must be ≥ 2 characters)
 */
function searchTable(guestName) {
    if (guestTableMap.has(guestName)) {
        return guestTableMap.get(guestName);
    }

    if (guestName.length >= 2) {
        for (const [name, table] of guestTableMap.entries()) {
            if (name.includes(guestName)) {
                return `${table}（賓客：${name}）`;
            }
        }
    }

    return null;
}

module.exports = { loadTableData, searchTable };
