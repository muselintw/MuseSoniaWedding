const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// In-memory map: guest name → table name
const guestTableMap = new Map();

function loadTableData() {
    try {
        const csvPath = path.join(__dirname, '桌次.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf8');

        const records = parse(fileContent, {
            skip_empty_lines: false,
            relax_column_count: true,
        });

        guestTableMap.clear();

        // CSV layout — two blocks sharing the same structure:
        //
        //   Block 1 : row 0  (header) + rows 1-12  → 主桌 to Table 7
        //   Block 2 : row 13 (header) + rows 14-24 → Table 8 to Table 13
        //
        //   Header row : even col (0, 2, 4…) = table name
        //   Data row   : even col = seat#, odd col = guest name
        //
        //   Columns 14+ are a separate seat-overview section — skip them.

        const MAX_COL = 14; // only process columns 0..13 (7 table pairs)
        const activeHeaders = {}; // col index → table name

        for (const row of records) {
            // Detect header row: at least one even column contains "Table" or "主桌"
            let isHeader = false;
            for (let col = 0; col < Math.min(row.length, MAX_COL); col += 2) {
                const cell = (row[col] || '').trim();
                if (cell && (cell.startsWith('Table') || cell === '主桌')) {
                    activeHeaders[col] = cell;
                    isHeader = true;
                }
            }
            if (isHeader) continue;

            // Data row: extract (seat, name) pairs
            for (let col = 0; col < Math.min(row.length, MAX_COL); col += 2) {
                const seat = (row[col] || '').trim();
                const name = (row[col + 1] || '').trim();
                if (seat && name) {
                    guestTableMap.set(name, activeHeaders[col] || '未知桌次');
                }
            }
        }

        console.log(`✅ Loaded ${guestTableMap.size} guests from 桌次.csv`);
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
