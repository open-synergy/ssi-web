/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.gantt_arrow", function (require) {
    "use strict";

    const core = require("web.core");

    const _t = core._t;

    // Which edge of the predecessor the line leaves from, and which edge of the
    // successor it enters, for each dependency type.
    const ANCHORS = {
        fs: {from: "finish", to: "start"},
        ss: {from: "start", to: "start"},
        ff: {from: "finish", to: "finish"},
        sf: {from: "start", to: "finish"},
    };

    const TYPE_LABELS = {
        fs: "FS",
        ss: "SS",
        ff: "FF",
        sf: "SF",
    };

    const DEFAULT_LAYOUT = {
        rowHeight: 32,
        stub: 12,
        radius: 3,
        minLabelSegment: 24,
    };

    /**
     * The point at which the line touches a bar: the middle of the requested
     * vertical edge.
     *
     * @param {Object} rect {x, y, w, h, row}
     * @param {String} side "start" (left edge) or "finish" (right edge)
     * @returns {Object} {x, y}
     */
    function anchorPoint(rect, side) {
        return {
            x: side === "finish" ? rect.x + rect.w : rect.x,
            y: rect.y + rect.h / 2,
        };
    }

    /**
     * Route an orthogonal polyline between two bars.
     *
     * A "finish" anchor is left towards +x and entered from +x; a "start"
     * anchor is left towards -x and entered from -x. That gives two genuinely
     * different situations, which are deliberately not merged:
     *
     * - opposite travel directions (SS and FF): a three-segment "U" through the
     *   outermost corridor always fits;
     * - identical travel directions (FS and SF): a three-segment "Z" when there
     *   is room ahead, otherwise a five-segment detour through the empty band
     *   between two rows.
     *
     * @param {Object} predRect {x, y, w, h, row}
     * @param {Object} succRect {x, y, w, h, row}
     * @param {String} type one of "fs", "ss", "ff", "sf"
     * @param {Object} [layout]
     * @returns {Array} the polyline points, [{x, y}]
     */
    function route(predRect, succRect, type, layout) {
        const config = layout || DEFAULT_LAYOUT;
        const anchors = ANCHORS[type] || ANCHORS.fs;
        const stub = config.stub;
        const p0 = anchorPoint(predRect, anchors.from);
        const q0 = anchorPoint(succRect, anchors.to);
        const exitDir = anchors.from === "finish" ? 1 : -1;
        const entryDir = anchors.to === "start" ? 1 : -1;
        const p1x = p0.x + exitDir * stub;
        const q1x = q0.x - entryDir * stub;

        if (exitDir !== entryDir) {
            // SS and FF: both stubs point the same way in space, so a single
            // corridor beyond the outermost of them always clears both bars.
            const mx = exitDir < 0 ? Math.min(p1x, q1x) : Math.max(p1x, q1x);
            return [p0, {x: mx, y: p0.y}, {x: mx, y: q0.y}, q0];
        }

        if (exitDir * (q1x - p1x) >= 0) {
            // Room ahead: the last horizontal segment is exactly one stub long,
            // so the arrow head always has space to be drawn.
            return [p0, {x: q1x, y: p0.y}, {x: q1x, y: q0.y}, q0];
        }

        // Backwards or overlapping: detour through the boundary line above the
        // lower of the two rows. Bars are inset vertically, so that line always
        // falls in an empty band.
        const gy = Math.max(predRect.row, succRect.row) * config.rowHeight;
        return [
            p0,
            {x: p1x, y: p0.y},
            {x: p1x, y: gy},
            {x: q1x, y: gy},
            {x: q1x, y: q0.y},
            q0,
        ];
    }

    /**
     * @param {Object} a
     * @param {Object} b
     * @returns {Number} the distance between two points
     */
    function distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }

    /**
     * The point located ``length`` pixels away from ``from`` on the way to
     * ``to``.
     *
     * @param {Object} from
     * @param {Object} to
     * @param {Number} length
     * @returns {Object}
     */
    function towards(from, to, length) {
        const total = distance(from, to);
        if (!total) {
            return {x: from.x, y: from.y};
        }
        const ratio = length / total;
        return {
            x: from.x + (to.x - from.x) * ratio,
            y: from.y + (to.y - from.y) * ratio,
        };
    }

    /**
     * Turn a polyline into an SVG path whose corners are rounded.
     *
     * @param {Array} points [{x, y}]
     * @param {Number} [radius]
     * @returns {String} an SVG path
     */
    function pointsToPath(points, radius) {
        if (points.length < 2) {
            return "";
        }
        const r = radius === undefined ? DEFAULT_LAYOUT.radius : radius;
        const round = (value) => Math.round(value);
        const parts = ["M " + round(points[0].x) + " " + round(points[0].y)];
        for (let index = 1; index < points.length - 1; index++) {
            const previous = points[index - 1];
            const corner = points[index];
            const next = points[index + 1];
            const effective = Math.min(
                r,
                distance(previous, corner) / 2,
                distance(corner, next) / 2
            );
            if (effective <= 0) {
                parts.push("L " + round(corner.x) + " " + round(corner.y));
                continue;
            }
            const before = towards(corner, previous, effective);
            const after = towards(corner, next, effective);
            parts.push("L " + round(before.x) + " " + round(before.y));
            parts.push(
                "Q " +
                    round(corner.x) +
                    " " +
                    round(corner.y) +
                    " " +
                    round(after.x) +
                    " " +
                    round(after.y)
            );
        }
        const last = points[points.length - 1];
        parts.push("L " + round(last.x) + " " + round(last.y));
        return parts.join(" ");
    }

    /**
     * Where to write the lag label: the middle of the longest horizontal
     * segment, which is the only place wide enough to stay readable.
     *
     * @param {Array} points [{x, y}]
     * @returns {Object|false} {x, y, length}
     */
    function lagLabelAnchor(points) {
        let best = false;
        for (let index = 0; index < points.length - 1; index++) {
            const a = points[index];
            const b = points[index + 1];
            if (a.y !== b.y) {
                continue;
            }
            const length = Math.abs(b.x - a.x);
            if (!best || length > best.length) {
                best = {x: (a.x + b.x) / 2, y: a.y, length: length};
            }
        }
        return best;
    }

    /**
     * Is the actual schedule breaking the constraint the dependency expresses?
     *
     * ``finish`` is the exclusive instant at which the work stops, so a
     * finish-to-start dependency with a zero lag whose successor starts exactly
     * when the predecessor ends is satisfied, not violated.
     *
     * @param {String} type "fs", "ss", "ff" or "sf"
     * @param {Object} pred {start, finish} display moments
     * @param {Object} succ {start, finish} display moments
     * @param {Number} lag
     * @param {String} unit the moment unit of the lag
     * @returns {Boolean}
     */
    function isViolated(type, pred, succ, lag, unit) {
        const shift = (m) => m.clone().add(lag, unit);
        switch (type) {
            case "fs":
                return succ.start.isBefore(shift(pred.finish));
            case "ss":
                return succ.start.isBefore(shift(pred.start));
            case "ff":
                return succ.finish.isBefore(shift(pred.finish));
            case "sf":
                return succ.finish.isBefore(shift(pred.start));
            default:
                return false;
        }
    }

    /**
     * Format the lag as it is written next to the arrow.
     *
     * @param {Number} lag
     * @param {String} unit
     * @returns {String}
     */
    function formatLag(lag, unit) {
        const suffix = unit === "hours" ? "h" : "d";
        return (lag > 0 ? "+" : "") + lag + suffix;
    }

    /**
     * Build everything the renderer needs to draw one dependency arrow. This is
     * the only entry point the renderer calls.
     *
     * @param {Object} link {predecessor, successor, type, lag, lagUnit}
     * @param {Object} predRect {x, y, w, h, row}
     * @param {Object} succRect {x, y, w, h, row}
     * @param {Object} predInterval {start, finish}
     * @param {Object} succInterval {start, finish}
     * @param {Object} [layout]
     * @returns {Object} {path, label, violated, title}
     */
    function buildArrow(link, predRect, succRect, predInterval, succInterval, layout) {
        const config = layout || DEFAULT_LAYOUT;
        const type = ANCHORS[link.type] ? link.type : "fs";
        const lag = link.lag || 0;
        const unit = link.lagUnit || "days";
        const points = route(predRect, succRect, type, config);
        const violated = isViolated(type, predInterval, succInterval, lag, unit);
        const typeLabel = TYPE_LABELS[type];
        const lagLabel = lag ? " " + formatLag(lag, unit) : "";

        let label = false;
        if (lag) {
            const anchor = lagLabelAnchor(points);
            if (anchor && anchor.length >= config.minLabelSegment) {
                label = {
                    x: Math.round(anchor.x),
                    y: Math.round(anchor.y),
                    text: formatLag(lag, unit),
                };
            }
        }

        const title = violated
            ? _.str.sprintf(
                  _t("%s%s violated: the successor is scheduled too early"),
                  typeLabel,
                  lagLabel
              )
            : typeLabel + lagLabel;

        return {
            path: pointsToPath(points, config.radius),
            label: label,
            violated: violated,
            title: title,
        };
    }

    return {
        ANCHORS: ANCHORS,
        DEFAULT_LAYOUT: DEFAULT_LAYOUT,
        TYPE_LABELS: TYPE_LABELS,
        anchorPoint: anchorPoint,
        buildArrow: buildArrow,
        formatLag: formatLag,
        isViolated: isViolated,
        lagLabelAnchor: lagLabelAnchor,
        pointsToPath: pointsToPath,
        route: route,
    };
});
