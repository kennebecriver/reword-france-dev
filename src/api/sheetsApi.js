// Data access layer for Google Sheets.
/**
 * Sheets API factory. `fetchData()` requests spreadsheet metadata and a batchGet of values,
 * returning an object mapping sheetName -> Array<{text1,text2,text3}>.
 */
export function createSheetsApi(config) {
    return {
        async fetchData() {
            if (!config.apiKey || !config.sheetId) {
                throw new Error('Missing URL config');
            }

            const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}?key=${config.apiKey}`);
            const meta = await metaRes.json();
            if (meta.error) throw new Error(meta.error.message);

            const sheetNames = meta.sheets.map((sheet) => sheet.properties.title);
            const ranges = sheetNames.map((name) => `${name}!A1:C2000`).join('&ranges=');
            const dataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values:batchGet?key=${config.apiKey}&ranges=${ranges}`);
            const dataJSON = await dataRes.json();

            const result = {};
            dataJSON.valueRanges.forEach((range, idx) => {
                const name = sheetNames[idx];
                const rows = range.values || [];
                const cards = rows
                    .map((row, arrayIndex) => ({ row, arrayIndex }))
                    .filter(({ row }) => row[0] && row[0] !== 'text1')
                    .map(({ row, arrayIndex }) => ({
                        text1: row[0],
                        text2: row[1] || '',
                        text3: row[2] || '',
                        rowIndex: arrayIndex + 1 // 1-indexed, row 1 is headers
                    }));

                if (cards.length > 0) result[name] = cards;
            });

            return result;
        }
    };
}
