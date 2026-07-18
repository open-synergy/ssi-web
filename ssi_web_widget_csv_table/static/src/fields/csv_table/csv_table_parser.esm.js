/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

/**
 * Parse a CSV string into a 2D array of cell values, handling
 * double-quoted fields (escaped `""`, embedded commas, and embedded
 * newlines). Pure function — no DOM/jQuery access.
 *
 * @param {String} text - raw CSV text.
 * @returns {string[][]} 2D array of cell values, one sub-array per row.
 */
export function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    let i = 0;
    const len = (text || "").length;

    while (i < len) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < len && text[i + 1] === '"') {
                    // Escaped quote.
                    cell += '"';
                    i += 2;
                } else {
                    // End of quoted field.
                    inQuotes = false;
                    i++;
                }
            } else {
                cell += ch;
                i++;
            }
        } else if (ch === '"') {
            inQuotes = true;
            i++;
        } else if (ch === ",") {
            row.push(cell);
            cell = "";
            i++;
        } else if (ch === "\r") {
            row.push(cell);
            cell = "";
            rows.push(row);
            row = [];
            i++;
            if (i < len && text[i] === "\n") {
                i++;
            }
        } else if (ch === "\n") {
            row.push(cell);
            cell = "";
            rows.push(row);
            row = [];
            i++;
        } else {
            cell += ch;
            i++;
        }
    }

    // Push the trailing cell/row, if any.
    if (cell !== "" || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
}

/**
 * Serialize a 2D array of cell values back into a CSV string, re-quoting
 * any cell that contains a comma, a double quote, or a newline. Pure
 * function — the inverse of `parseCSV`.
 *
 * @param {string[][]} rows - 2D array of cell values.
 * @returns {String} CSV text.
 */
export function rowsToCSV(rows) {
    const lines = [];
    for (const row of rows) {
        const csvRow = [];
        for (let cell of row) {
            cell = cell || "";
            if (
                cell.indexOf(",") !== -1 ||
                cell.indexOf('"') !== -1 ||
                cell.indexOf("\n") !== -1 ||
                cell.indexOf("\r") !== -1
            ) {
                cell = '"' + cell.replace(/"/g, '""') + '"';
            }
            csvRow.push(cell);
        }
        lines.push(csvRow.join(","));
    }
    return lines.join("\n");
}
