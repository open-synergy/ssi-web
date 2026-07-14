/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.gantt_utils", function (require) {
    "use strict";

    const session = require("web.session");

    // A time scale is described by a minor unit (one column) and a major unit
    // (the header band above the columns). "step" is the unit accepted by
    // moment.add(), which is not always the unit accepted by moment.startOf():
    // "isoWeek" is a valid startOf() unit but not a valid add() unit.
    const SCALES = {
        day: {
            minor: "hour",
            minorStep: "hour",
            minorFormat: "HH",
            major: "day",
            majorStep: "day",
            majorFormat: "dddd, LL",
            colWidth: 30,
        },
        week: {
            minor: "day",
            minorStep: "day",
            minorFormat: "dd DD",
            major: "week",
            majorStep: "week",
            majorFormat: "[W]W YYYY",
            colWidth: 60,
        },
        month: {
            minor: "day",
            minorStep: "day",
            minorFormat: "DD",
            major: "month",
            majorStep: "month",
            majorFormat: "MMMM YYYY",
            colWidth: 26,
        },
        quarter: {
            minor: "isoWeek",
            minorStep: "week",
            minorFormat: "[W]W",
            major: "month",
            majorStep: "month",
            majorFormat: "MMM YYYY",
            colWidth: 40,
        },
        year: {
            minor: "month",
            minorStep: "month",
            minorFormat: "MMM",
            major: "year",
            majorStep: "year",
            majorFormat: "YYYY",
            colWidth: 70,
        },
    };

    const SCALE_NAMES = ["day", "week", "month", "quarter", "year"];

    // A finer scale over a wide date range produces an unbounded number of
    // columns. Past this cap the timescale stops materialising columns and
    // dateToPx falls back to linear extension, which stays accurate for the
    // fixed-length units (hour, day) where the cap is actually reachable.
    const MAX_COLUMNS = 4000;

    // Canonical dependency type codes. The numeric aliases follow the
    // MS-Project / PMBOK ordering: 0=FS, 1=SS, 2=FF, 3=SF.
    const DEP_TYPE_ALIASES = {
        fs: ["fs", "es", "finishtostart", "finishstart", "endtostart", "endstart", "0"],
        ss: ["ss", "starttostart", "startstart", "1"],
        ff: ["ff", "ee", "finishtofinish", "finishfinish", "endtoend", "endend", "2"],
        sf: ["sf", "se", "starttofinish", "startfinish", "starttoend", "startend", "3"],
    };

    const ALIAS_LOOKUP = {};
    for (const canonical of Object.keys(DEP_TYPE_ALIASES)) {
        for (const alias of DEP_TYPE_ALIASES[canonical]) {
            ALIAS_LOOKUP[alias] = canonical;
        }
    }

    /**
     * Reduce any raw value to a comparable key: lowercase, alphanumeric only.
     *
     * @param {*} value
     * @returns {String}
     */
    function slug(value) {
        return String(value)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    /**
     * @param {*} value
     * @returns {Boolean} true when the value carries no information at all
     */
    function isBlank(value) {
        return (
            value === false ||
            value === null ||
            value === undefined ||
            value === "" ||
            (Array.isArray(value) && value.length === 0)
        );
    }

    /**
     * Compile the ``dependency_type_map`` arch attribute into a flat lookup
     * table mapping a raw value (and its slug) to a canonical type code.
     *
     * Two syntaxes are accepted: the ``colors=``-like syntax, canonical code
     * first (``fs:finish_start|end_start;ss:start_start``), and JSON mapping a
     * raw value to a canonical code (``{"selesai_mulai": "fs"}``).
     *
     * @param {String} spec
     * @returns {Object|null}
     */
    function parseTypeMap(spec) {
        if (!spec) {
            return null;
        }
        const trimmed = String(spec).trim();
        const map = {};
        if (trimmed.charAt(0) === "{") {
            const parsed = JSON.parse(trimmed);
            for (const raw of Object.keys(parsed)) {
                const canonical = slug(parsed[raw]);
                map[raw] = canonical;
                map[slug(raw)] = canonical;
            }
            return map;
        }
        for (const chunk of trimmed.split(";")) {
            if (!chunk.trim()) {
                continue;
            }
            const pair = chunk.split(":");
            if (pair.length < 2) {
                continue;
            }
            const canonical = slug(pair[0]);
            for (const raw of pair.slice(1).join(":").split("|")) {
                const value = raw.trim();
                if (value) {
                    map[value] = canonical;
                    map[slug(value)] = canonical;
                }
            }
        }
        return map;
    }

    /**
     * @param {*} value
     * @param {Object|null} typeMap
     * @returns {String|false}
     */
    function mapLookup(value, typeMap) {
        if (!typeMap || isBlank(value)) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(typeMap, String(value))) {
            return typeMap[String(value)];
        }
        const key = slug(value);
        if (Object.prototype.hasOwnProperty.call(typeMap, key)) {
            return typeMap[key];
        }
        return false;
    }

    /**
     * @param {*} value
     * @returns {String|false}
     */
    function aliasLookup(value) {
        if (isBlank(value)) {
            return false;
        }
        return ALIAS_LOOKUP[slug(value)] || false;
    }

    /**
     * Normalize the raw value of the dependency type field into one of the four
     * canonical codes "fs", "ss", "ff" or "sf".
     *
     * A many2one type field is read by search_read as ``[id, "Finish to
     * Start"]``, so both members are tried, the label first.
     *
     * @param {*} raw
     * @param {Object|null} typeMap compiled by parseTypeMap
     * @param {String} [fallback="fs"] used when the value cannot be normalized
     * @param {Set} [warned] guards against flooding the console on large views
     * @returns {String} one of "fs", "ss", "ff", "sf"
     */
    function normalizeDepType(raw, typeMap, fallback, warned) {
        const defaultType = aliasLookup(fallback) || "fs";
        // An empty Selection is a legitimate value: fall back silently.
        if (isBlank(raw)) {
            return defaultType;
        }
        const candidates = Array.isArray(raw) ? [raw[1], raw[0]] : [raw];
        for (const candidate of candidates) {
            const mapped = mapLookup(candidate, typeMap);
            if (mapped) {
                return mapped;
            }
        }
        for (const candidate of candidates) {
            const aliased = aliasLookup(candidate);
            if (aliased) {
                return aliased;
            }
        }
        const key = JSON.stringify(raw);
        if (!warned || !warned.has(key)) {
            if (warned) {
                warned.add(key);
            }
            console.warn(
                "ssi_web_gantt: unknown dependency type " +
                    key +
                    ", falling back to " +
                    defaultType
            );
        }
        return defaultType;
    }

    /**
     * Convert a server value into a "display moment": a moment in UTC mode
     * whose calendar fields already hold the user's wall clock. Every px, diff
     * and startOf computation happens in that space, which keeps the arithmetic
     * both consistent and DST-safe, and aligns a bar with the datetime the form
     * view displays for the very same record.
     *
     * @param {String|false} value as returned by search_read
     * @param {String} fieldType "date" or "datetime"
     * @returns {Object|false} a moment, or false when the value is empty
     */
    function toDisplayMoment(value, fieldType) {
        if (!value) {
            return false;
        }
        if (fieldType === "date") {
            return moment.utc(value, "YYYY-MM-DD");
        }
        const utc = moment.utc(value, "YYYY-MM-DD HH:mm:ss");
        return utc.add(session.getTZOffset(utc), "minutes");
    }

    /**
     * The instant the view considers "now", in display-moment space, so that
     * the today marker follows the Odoo user's timezone rather than the
     * browser's.
     *
     * @returns {Object} a moment
     */
    function nowDisplayMoment() {
        const utc = moment.utc();
        return utc.add(session.getTZOffset(utc), "minutes");
    }

    /**
     * Compute the [start, finish[ interval of a record.
     *
     * ``finish`` is the exclusive instant at which the work stops. A datetime
     * is already exclusive, but a ``date`` field is by Odoo convention the last
     * inclusive day, so it is normalized by adding one day unless
     * ``date_stop_inclusive="0"`` says otherwise.
     *
     * @param {Object} record as returned by search_read
     * @param {Object} cfg the arch configuration
     * @param {Object} fields viewInfo.fields
     * @returns {Object|false} {start, finish, milestone} or false when the
     *      record has no start date at all
     */
    function recordInterval(record, cfg, fields) {
        const startField = fields[cfg.dateStart] || {};
        const start = toDisplayMoment(record[cfg.dateStart], startField.type);
        if (!start) {
            return false;
        }
        let finish = false;
        if (cfg.dateStop && record[cfg.dateStop]) {
            const stopField = fields[cfg.dateStop] || {};
            finish = toDisplayMoment(record[cfg.dateStop], stopField.type);
            if (finish && cfg.dateStopInclusive) {
                finish = finish.clone().add(1, "days");
            }
        } else if (cfg.dateDelay && record[cfg.dateDelay]) {
            finish = start.clone().add(record[cfg.dateDelay], cfg.delayUnit);
        }
        let milestone = false;
        if (!finish || !finish.isAfter(start)) {
            finish = start.clone();
            milestone = true;
        }
        return {start: start, finish: finish, milestone: milestone};
    }

    /**
     * Build the explicit column array of a time scale.
     *
     * Months and years have a variable length and DST shifts the length of a
     * day, so no constant "pixels per millisecond" can be correct. Columns are
     * materialized once per (scale, zoom, data range) and looked up by binary
     * search instead.
     *
     * @param {String} scaleName
     * @param {Number} zoom column width multiplier
     * @param {Object} minMoment earliest date to cover
     * @param {Object} maxMoment latest date to cover
     * @returns {Object} the timescale
     */
    function buildTimescale(scaleName, zoom, minMoment, maxMoment) {
        const spec = SCALES[scaleName] || SCALES.month;
        const colWidth = Math.max(1, Math.round(spec.colWidth * zoom));
        const origin = minMoment.clone().startOf(spec.major).startOf(spec.minor);
        const end = maxMoment.clone().startOf(spec.major).add(1, spec.majorStep);
        const columns = [];
        const cursor = origin.clone();
        let truncated = false;
        while (cursor.isBefore(end)) {
            if (columns.length >= MAX_COLUMNS) {
                truncated = true;
                break;
            }
            const columnEnd = cursor.clone().add(1, spec.minorStep);
            columns.push({
                start: cursor.clone(),
                end: columnEnd,
                ms: columnEnd.valueOf() - cursor.valueOf(),
            });
            cursor.add(1, spec.minorStep);
        }
        if (!columns.length) {
            const columnEnd = origin.clone().add(1, spec.minorStep);
            columns.push({
                start: origin.clone(),
                end: columnEnd,
                ms: columnEnd.valueOf() - origin.valueOf(),
            });
        }
        if (truncated) {
            console.warn(
                "ssi_web_gantt: the " +
                    scaleName +
                    " scale needs more than " +
                    MAX_COLUMNS +
                    " columns for this date range; dates beyond the last column " +
                    "are positioned by linear extension."
            );
        }
        const last = columns[columns.length - 1];
        return {
            name: scaleName,
            spec: spec,
            zoom: zoom,
            colWidth: colWidth,
            columns: columns,
            totalWidth: columns.length * colWidth,
            origin: origin,
            end: last.end,
        };
    }

    /**
     * Index of the column holding the given timestamp, or -1 before the first
     * column and columns.length beyond the last one.
     *
     * @param {Object} ts a timescale
     * @param {Number} value a timestamp in milliseconds
     * @returns {Number}
     */
    function columnIndex(ts, value) {
        const columns = ts.columns;
        if (value < columns[0].start.valueOf()) {
            return -1;
        }
        if (value >= columns[columns.length - 1].end.valueOf()) {
            return columns.length;
        }
        let low = 0;
        let high = columns.length - 1;
        while (low < high) {
            const middle = Math.floor((low + high + 1) / 2);
            if (columns[middle].start.valueOf() <= value) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }
        return low;
    }

    /**
     * Horizontal position, in pixels, of a moment on a timescale. Moments
     * outside the materialized range are extended linearly from the closest
     * column.
     *
     * @param {Object} ts a timescale
     * @param {Object} m a display moment
     * @returns {Number}
     */
    function dateToPx(ts, m) {
        const value = m.valueOf();
        const index = columnIndex(ts, value);
        const columns = ts.columns;
        if (index < 0) {
            const first = columns[0];
            return ((value - first.start.valueOf()) / first.ms) * ts.colWidth;
        }
        if (index >= columns.length) {
            const last = columns[columns.length - 1];
            return (
                ts.totalWidth + ((value - last.end.valueOf()) / last.ms) * ts.colWidth
            );
        }
        const column = columns[index];
        const offset = (value - column.start.valueOf()) / column.ms;
        return (index + offset) * ts.colWidth;
    }

    /**
     * Inverse of dateToPx.
     *
     * @param {Object} ts a timescale
     * @param {Number} x a horizontal position in pixels
     * @returns {Object} a display moment
     */
    function pxToDate(ts, x) {
        const columns = ts.columns;
        const index = Math.floor(x / ts.colWidth);
        if (index < 0) {
            const first = columns[0];
            return first.start.clone().add((x / ts.colWidth) * first.ms, "ms");
        }
        if (index >= columns.length) {
            const last = columns[columns.length - 1];
            const overflow = x - ts.totalWidth;
            return last.end.clone().add((overflow / ts.colWidth) * last.ms, "ms");
        }
        const column = columns[index];
        const fraction = (x - index * ts.colWidth) / ts.colWidth;
        return column.start.clone().add(fraction * column.ms, "ms");
    }

    /**
     * Group the columns of a timescale into the major header bands drawn above
     * them.
     *
     * @param {Object} ts a timescale
     * @returns {Array} [{label, x, width}]
     */
    function majorBands(ts) {
        const spec = ts.spec;
        const bands = [];
        let current = null;
        ts.columns.forEach((column, index) => {
            const key = column.start.clone().startOf(spec.major).valueOf();
            if (!current || current.key !== key) {
                current = {
                    key: key,
                    label: column.start.format(spec.majorFormat),
                    x: index * ts.colWidth,
                    width: ts.colWidth,
                };
                bands.push(current);
            } else {
                current.width += ts.colWidth;
            }
        });
        return bands;
    }

    return {
        ALIAS_LOOKUP: ALIAS_LOOKUP,
        DEP_TYPE_ALIASES: DEP_TYPE_ALIASES,
        MAX_COLUMNS: MAX_COLUMNS,
        SCALES: SCALES,
        SCALE_NAMES: SCALE_NAMES,
        aliasLookup: aliasLookup,
        buildTimescale: buildTimescale,
        columnIndex: columnIndex,
        dateToPx: dateToPx,
        isBlank: isBlank,
        majorBands: majorBands,
        normalizeDepType: normalizeDepType,
        nowDisplayMoment: nowDisplayMoment,
        parseTypeMap: parseTypeMap,
        pxToDate: pxToDate,
        recordInterval: recordInterval,
        slug: slug,
        toDisplayMoment: toDisplayMoment,
    };
});
