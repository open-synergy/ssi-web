/* Copyright 2025 OpenSynergy Indonesia
 * Copyright 2025 PT. Simetri Sinergi Indonesia
 * Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
 *
 * Pure JavaScript XLSX writer.
 * No external SheetJS dependency required.
 * Generates a valid .xlsx (Open XML SpreadsheetML) file.
 *
 * ESM port of the 14.0 `xlsx_writer.js` (which attached itself to
 * `window.SsiXlsxWriter`). The writing logic below is unchanged; only the
 * module wrapper changed, from an IIFE assigning to `window` to a plain ESM
 * export, since the Odoo 19 build has no `odoo.define`/global-script
 * loading order to depend on.
 */

/**
 * Escape XML special characters.
 *
 * @param {*} str
 * @returns {String}
 */
function escapeXml(str) {
    if (typeof str !== "string") {
        str = String(str === null || str === undefined ? "" : str);
    }
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Convert a column index (0-based) to an Excel column letter.
 * 0 -> A, 25 -> Z, 26 -> AA, etc.
 *
 * @param {Number} idx
 * @returns {String}
 */
function colLetter(idx) {
    var s = "";
    var n = idx;
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

/**
 * Build the XML for a worksheet from a 2-D data array.
 * First row is treated as the header (bold).
 *
 * @param {Array<Array>} data
 * @returns {String}
 */
function buildSheetXml(data) {
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml +=
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

    // Column widths
    if (data.length > 0) {
        var numCols = data[0].length;
        xml += "<cols>";
        for (var ci = 0; ci < numCols; ci++) {
            // Calculate width based on max content length
            var maxLen = 10;
            for (var ri = 0; ri < data.length; ri++) {
                var cellVal = data[ri][ci];
                var len =
                    cellVal !== null && cellVal !== undefined
                        ? String(cellVal).length
                        : 0;
                if (len > maxLen) {
                    maxLen = len;
                }
            }
            var width = Math.min(maxLen + 4, 60);
            xml +=
                '<col min="' +
                (ci + 1) +
                '" max="' +
                (ci + 1) +
                '" width="' +
                width +
                '" customWidth="1"/>';
        }
        xml += "</cols>";
    }

    xml += "<sheetData>";
    for (var r = 0; r < data.length; r++) {
        var row = data[r];
        xml += '<row r="' + (r + 1) + '">';
        for (var c = 0; c < row.length; c++) {
            var ref = colLetter(c) + (r + 1);
            var val = row[c];
            if (val === null || val === undefined) {
                val = "";
            }
            // Determine if numeric
            var numVal = Number(val);
            if (val !== "" && !isNaN(numVal) && isFinite(numVal)) {
                // Header row gets style 1 (bold)
                if (r === 0) {
                    xml += '<c r="' + ref + '" s="1"><v>' + numVal + "</v></c>";
                } else {
                    xml += '<c r="' + ref + '"><v>' + numVal + "</v></c>";
                }
            } else if (r === 0) {
                // Inline string - header row
                xml +=
                    '<c r="' +
                    ref +
                    '" t="inlineStr" s="1"><is><t>' +
                    escapeXml(String(val)) +
                    "</t></is></c>";
            } else {
                // Inline string
                xml +=
                    '<c r="' +
                    ref +
                    '" t="inlineStr"><is><t>' +
                    escapeXml(String(val)) +
                    "</t></is></c>";
            }
        }
        xml += "</row>";
    }
    xml += "</sheetData></worksheet>";
    return xml;
}

/**
 * Build a minimal styles.xml with a bold style for the header row.
 *
 * @returns {String}
 */
function buildStylesXml() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        "<fonts>" +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
        "</fonts>" +
        '<fills><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        "<borders><border>" +
        "<left/><right/><top/><bottom/><diagonal/>" +
        "</border></borders>" +
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellXfs count="2">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        "</cellXfs>" +
        "</styleSheet>"
    );
}

/**
 * Build [Content_Types].xml
 *
 * @returns {String}
 */
function buildContentTypes() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>"
    );
}

/**
 * Build _rels/.rels
 *
 * @returns {String}
 */
function buildRootRels() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>"
    );
}

/**
 * Build xl/_rels/workbook.xml.rels
 *
 * @returns {String}
 */
function buildWorkbookRels() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>"
    );
}

/**
 * Build xl/workbook.xml
 *
 * @returns {String}
 */
function buildWorkbookXml() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        "<sheets>" +
        '<sheet name="Sheet1" sheetId="1" r:id="rId1"/>' +
        "</sheets>" +
        "</workbook>"
    );
}

// ---------------------------------------------------------------
// Minimal ZIP writer (no external library)
// Produces a valid ZIP archive as a Uint8Array.
// ---------------------------------------------------------------

/**
 * @param {Uint8Array} data
 * @returns {Number}
 */
function crc32(data) {
    var table = crc32.table;
    if (!table) {
        table = new Uint32Array(256);
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var j = 0; j < 8; j++) {
                if (c & 1) {
                    c = 0xedb88320 ^ (c >>> 1);
                } else {
                    c >>>= 1;
                }
            }
            table[i] = c;
        }
        crc32.table = table;
    }
    var crc = 0xffffffff;
    for (var k = 0; k < data.length; k++) {
        crc = table[(crc ^ data[k]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {String} str
 * @returns {Uint8Array}
 */
function strToU8(str) {
    // TextEncoder handles UTF-8 correctly
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(str);
    }
    // Fallback for older browsers
    var arr = [];
    for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        if (code < 0x80) {
            arr.push(code);
        } else if (code < 0x800) {
            arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else {
            arr.push(
                0xe0 | (code >> 12),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
            );
        }
    }
    return new Uint8Array(arr);
}

/**
 * @param {Number} val
 * @returns {Array<Number>}
 */
function writeU16LE(val) {
    return [val & 0xff, (val >> 8) & 0xff];
}

/**
 * @param {Number} val
 * @returns {Array<Number>}
 */
function writeU32LE(val) {
    return [val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff];
}

/**
 * Create a ZIP archive from an object map {filename: stringContent}.
 * Returns a Uint8Array.
 *
 * @param {Object} files
 * @returns {Uint8Array}
 */
function createZip(files) {
    var localHeaders = [];
    var centralHeaders = [];
    var offset = 0;

    var filenames = Object.keys(files);
    for (var i = 0; i < filenames.length; i++) {
        var name = filenames[i];
        var content = strToU8(files[name]);
        var nameBytes = strToU8(name);
        var crc = crc32(content);
        var size = content.length;

        // Local file header
        var local = [].concat(
            [0x50, 0x4b, 0x03, 0x04], // Signature
            writeU16LE(20), // Version needed
            writeU16LE(0), // Flags
            writeU16LE(0), // Compression (store)
            writeU16LE(0), // Mod time
            writeU16LE(0), // Mod date
            writeU32LE(crc),
            writeU32LE(size), // Compressed
            writeU32LE(size), // Uncompressed
            writeU16LE(nameBytes.length),
            writeU16LE(0) // Extra length
        );

        var localArr = new Uint8Array(local.length + nameBytes.length + size);
        localArr.set(local, 0);
        localArr.set(nameBytes, local.length);
        localArr.set(content, local.length + nameBytes.length);
        localHeaders.push(localArr);

        // Central directory header
        var central = [].concat(
            [0x50, 0x4b, 0x01, 0x02], // Signature
            writeU16LE(20), // Version made
            writeU16LE(20), // Version needed
            writeU16LE(0), // Flags
            writeU16LE(0), // Compression
            writeU16LE(0), // Mod time
            writeU16LE(0), // Mod date
            writeU32LE(crc),
            writeU32LE(size),
            writeU32LE(size),
            writeU16LE(nameBytes.length),
            writeU16LE(0), // Extra length
            writeU16LE(0), // Comment length
            writeU16LE(0), // Disk number
            writeU16LE(0), // Internal attrs
            writeU32LE(0), // External attrs
            writeU32LE(offset) // Relative offset
        );
        var centralArr = new Uint8Array(central.length + nameBytes.length);
        centralArr.set(central, 0);
        centralArr.set(nameBytes, central.length);
        centralHeaders.push(centralArr);

        offset += localArr.length;
    }

    var centralStart = offset;
    var centralSize = 0;
    for (var ci = 0; ci < centralHeaders.length; ci++) {
        centralSize += centralHeaders[ci].length;
    }

    // End of central directory
    var eocd = [].concat(
        [0x50, 0x4b, 0x05, 0x06],
        writeU16LE(0), // Disk number
        writeU16LE(0), // Central dir disk
        writeU16LE(filenames.length),
        writeU16LE(filenames.length),
        writeU32LE(centralSize),
        writeU32LE(centralStart),
        writeU16LE(0) // Comment length
    );

    var totalSize = offset + centralSize + eocd.length;
    var result = new Uint8Array(totalSize);
    var pos = 0;
    for (var li = 0; li < localHeaders.length; li++) {
        result.set(localHeaders[li], pos);
        pos += localHeaders[li].length;
    }
    for (var cj = 0; cj < centralHeaders.length; cj++) {
        result.set(centralHeaders[cj], pos);
        pos += centralHeaders[cj].length;
    }
    result.set(eocd, pos);

    return result;
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * Generate and trigger download of a .xlsx file from a 2-D data array.
 *
 * @param {Array<Array>} data - 2-D array; first row = header
 * @param {String} filename - filename WITHOUT extension
 */
export function downloadXlsx(data, filename) {
    var zipFiles = {
        "[Content_Types].xml": buildContentTypes(),
        "_rels/.rels": buildRootRels(),
        "xl/workbook.xml": buildWorkbookXml(),
        "xl/_rels/workbook.xml.rels": buildWorkbookRels(),
        "xl/styles.xml": buildStylesXml(),
        "xl/worksheets/sheet1.xml": buildSheetXml(data),
    };

    var zipData = createZip(zipFiles);
    var blob = new Blob([zipData], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Trigger download
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = (filename || "export") + ".xlsx";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
