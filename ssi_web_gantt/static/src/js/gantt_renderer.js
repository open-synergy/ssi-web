/* global py */
/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.GanttRenderer", function (require) {
    "use strict";

    const AbstractRenderer = require("web.AbstractRenderer");
    const QWeb = require("web.QWeb");
    const core = require("web.core");
    const field_utils = require("web.field_utils");
    const session = require("web.session");
    const utils = require("web.utils");
    const ganttArrow = require("ssi_web_gantt.gantt_arrow");
    const ganttUtils = require("ssi_web_gantt.gantt_utils");

    const qweb = core.qweb;

    const ROW_H = 32;
    const BAR_MARGIN_Y = 4;
    const HEADER_H = 48;
    const SIDEBAR_W = 260;
    const STUB = 12;
    const MIN_BAR_W = 4;
    const MILESTONE_W = 14;
    const ARROW_RADIUS = 3;
    const COLOR_COUNT = 12;

    const LAYOUT = {
        rowHeight: ROW_H,
        stub: STUB,
        radius: ARROW_RADIUS,
        minLabelSegment: 24,
    };

    const DECORATIONS = [
        "danger",
        "warning",
        "info",
        "success",
        "primary",
        "secondary",
        "muted",
    ];

    const GanttRenderer = AbstractRenderer.extend({
        template: "ssi_web_gantt.GanttView",

        /**
         * @override
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.cfg = params.cfg;
            this.fields = params.fields;
            this.modelName = params.modelName;
            this.arch = params.arch;
            this.scale = params.defaultScale;
            this.zoom = params.defaultZoom;
            this.decorations = params.decorations;
            this.scales = params.scales;
            this.warnedTypes = new Set();
            this.$poppedBars = $();
            this.timescale = null;

            this.qweb = new QWeb(session.debug, {_s: session.origin}, false);
            const templates = _.filter(
                this.arch.children,
                (child) => child.tag === "templates"
            );
            if (templates.length) {
                this.qweb.add_template(utils.json_node_to_xml(templates[0]));
            }
            this.hasItemTemplate = Boolean(this.qweb.templates["gantt-item"]);

            this._onPaneScroll = _.throttle(this._syncSidebarScroll.bind(this), 16);
        },

        /**
         * @override
         */
        destroy: function () {
            this._disposePopovers();
            this._super.apply(this, arguments);
        },

        // --------------------------------------------------------------------
        // Public
        // --------------------------------------------------------------------

        /**
         * Change the time scale without any round trip to the server: the whole
         * chart is a pure function of the records already loaded.
         *
         * @param {String} scale
         * @param {Number} zoom
         * @returns {Promise}
         */
        updateScale: function (scale, zoom) {
            this.scale = scale;
            this.zoom = Math.min(4, Math.max(0.5, zoom));
            return this._render();
        },

        /**
         * @override
         */
        getLocalState: function () {
            const pane = this.el.querySelector(".o_ssi_gantt_pane");
            if (!pane) {
                return {};
            }
            return {scrollLeft: pane.scrollLeft, scrollTop: pane.scrollTop};
        },

        /**
         * @override
         */
        setLocalState: function (localState) {
            const pane = this.el.querySelector(".o_ssi_gantt_pane");
            if (!pane || !localState) {
                return;
            }
            pane.scrollLeft = localState.scrollLeft || 0;
            pane.scrollTop = localState.scrollTop || 0;
            this._syncSidebarScroll();
        },

        /**
         * Scroll the viewport so that the current date is visible.
         */
        scrollToToday: function () {
            if (!this.timescale) {
                return;
            }
            const pane = this.el.querySelector(".o_ssi_gantt_pane");
            if (!pane) {
                return;
            }
            const x = ganttUtils.dateToPx(
                this.timescale,
                ganttUtils.nowDisplayMoment()
            );
            pane.scrollLeft = Math.max(0, x - pane.clientWidth / 3);
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * @override
         */
        _renderView: function () {
            this._disposePopovers();
            // The template root is .o_ssi_gantt_view, so it is this.$el itself.
            this.$el.find(".o_ssi_gantt_empty").remove();
            const $pane = this.$el.find(".o_ssi_gantt_pane");

            const rows = this._buildRows();
            const intervals = this._buildIntervals();
            if (!rows.length) {
                this.$el.addClass("o_ssi_gantt_is_empty");
                this.$el.append(qweb.render("ssi_web_gantt.Empty"));
                return this._super.apply(this, arguments);
            }
            this.$el.removeClass("o_ssi_gantt_is_empty");

            this.timescale = this._buildTimescale(intervals);
            const rects = this._buildRects(rows, intervals);

            this._renderHeader();
            this._renderSidebar(rows);
            this._renderRows(rows, rects, intervals);
            this._renderArrows(rects, intervals);

            $pane.off("scroll", this._onPaneScroll).on("scroll", this._onPaneScroll);
            this._syncSidebarScroll();

            return this._super.apply(this, arguments);
        },

        /**
         * Flatten the groups into the ordered list of rows actually drawn: one
         * row per group header, one row per record.
         *
         * @private
         * @returns {Array}
         */
        _buildRows: function () {
            const rows = [];
            for (const group of this.state.groups || []) {
                if (group.name !== false) {
                    rows.push({type: "group", label: group.name, record: false});
                }
                for (const record of group.records) {
                    rows.push({
                        type: "record",
                        label: record.display_name || String(record.id),
                        record: record,
                    });
                }
            }
            return rows;
        },

        /**
         * @private
         * @returns {Object} the interval of every record that has a start date
         */
        _buildIntervals: function () {
            const intervals = {};
            for (const record of this.state.records || []) {
                const interval = ganttUtils.recordInterval(
                    record,
                    this.cfg,
                    this.fields
                );
                if (interval) {
                    intervals[record.id] = interval;
                }
            }
            return intervals;
        },

        /**
         * @private
         * @param {Object} intervals
         * @returns {Object} a timescale covering every interval
         */
        _buildTimescale: function (intervals) {
            let min = false;
            let max = false;
            for (const key of Object.keys(intervals)) {
                const interval = intervals[key];
                if (!min || interval.start.isBefore(min)) {
                    min = interval.start;
                }
                if (!max || interval.finish.isAfter(max)) {
                    max = interval.finish;
                }
            }
            if (!min) {
                min = ganttUtils.nowDisplayMoment();
                max = min.clone().add(1, "days");
            }
            return ganttUtils.buildTimescale(
                this.scale,
                this.zoom,
                min.clone(),
                max.clone()
            );
        },

        /**
         * The rectangle of every bar, in the very coordinates later written as
         * the inline ``left``/``top`` of that bar. The arrow overlay shares the
         * same origin, so it consumes these numbers as they are: no offset(),
         * no getBoundingClientRect().
         *
         * @private
         * @param {Array} rows
         * @param {Object} intervals
         * @returns {Object} the rectangle of every drawn record, by id
         */
        _buildRects: function (rows, intervals) {
            const ts = this.timescale;
            const rects = {};
            rows.forEach((row, index) => {
                if (row.type !== "record") {
                    return;
                }
                const interval = intervals[row.record.id];
                if (!interval) {
                    return;
                }
                const startX = ganttUtils.dateToPx(ts, interval.start);
                const stopX = ganttUtils.dateToPx(ts, interval.finish);
                const milestone = interval.milestone;
                // A milestone is a square rotated by 45 degrees, so it has to
                // be square, and it is centred on its date rather than started
                // at it. Its centre stays on the row axis, which is what the
                // arrows anchor to.
                const x = milestone ? startX - MILESTONE_W / 2 : startX;
                const width = milestone
                    ? MILESTONE_W
                    : Math.max(MIN_BAR_W, stopX - startX);
                const height = milestone ? MILESTONE_W : ROW_H - 2 * BAR_MARGIN_Y;
                rects[row.record.id] = {
                    x: Math.round(x),
                    y: index * ROW_H + Math.round((ROW_H - height) / 2),
                    w: Math.round(width),
                    h: height,
                    row: index,
                    milestone: milestone,
                };
            });
            return rects;
        },

        /**
         * @private
         */
        _renderHeader: function () {
            const ts = this.timescale;
            const parts = [];
            for (const band of ganttUtils.majorBands(ts)) {
                parts.push(
                    '<div class="o_ssi_gantt_major" style="left:' +
                        band.x +
                        "px;width:" +
                        band.width +
                        'px;">' +
                        _.escape(band.label) +
                        "</div>"
                );
            }
            const today = ganttUtils.nowDisplayMoment();
            ts.columns.forEach((column, index) => {
                const isToday =
                    today.isSameOrAfter(column.start) && today.isBefore(column.end);
                parts.push(
                    '<div class="o_ssi_gantt_minor' +
                        (isToday ? " o_ssi_gantt_minor_today" : "") +
                        '" style="left:' +
                        index * ts.colWidth +
                        "px;width:" +
                        ts.colWidth +
                        'px;">' +
                        _.escape(column.start.format(ts.spec.minorFormat)) +
                        "</div>"
                );
            });
            const $canvas = this.$el.find(".o_ssi_gantt_canvas");
            $canvas.css("width", ts.totalWidth + "px");
            this.$el
                .find(".o_ssi_gantt_header")
                .css({width: ts.totalWidth + "px", height: HEADER_H + "px"})
                .html(parts.join(""));
        },

        /**
         * @private
         * @param {Array} rows
         */
        _renderSidebar: function (rows) {
            const parts = [];
            rows.forEach((row) => {
                const classes = ["o_ssi_gantt_sidebar_row"];
                if (row.type === "group") {
                    classes.push("o_ssi_gantt_sidebar_group");
                }
                parts.push(
                    '<div class="' +
                        classes.join(" ") +
                        '" style="height:' +
                        ROW_H +
                        'px;" title="' +
                        _.escape(row.label) +
                        '">' +
                        _.escape(row.label) +
                        "</div>"
                );
            });
            this.$el.find(".o_ssi_gantt_sidebar").css("width", SIDEBAR_W + "px");
            this.$el.find(".o_ssi_gantt_sidebar_header").css("height", HEADER_H + "px");
            this.$el.find(".o_ssi_gantt_sidebar_body").html(parts.join(""));
        },

        /**
         * @private
         * @param {Array} rows
         * @param {Object} rects
         * @param {Object} intervals
         */
        _renderRows: function (rows, rects, intervals) {
            const ts = this.timescale;
            const parts = [];
            rows.forEach((row, index) => {
                const classes = ["o_ssi_gantt_row"];
                if (row.type === "group") {
                    classes.push("o_ssi_gantt_row_group");
                } else if (!rects[row.record.id]) {
                    // The record has no start date: its row stays, greyed out,
                    // so that it does not silently disappear from the view.
                    classes.push("o_ssi_gantt_row_undated");
                }
                parts.push(
                    '<div class="' +
                        classes.join(" ") +
                        '" style="top:' +
                        index * ROW_H +
                        "px;height:" +
                        ROW_H +
                        "px;width:" +
                        ts.totalWidth +
                        'px;"></div>'
                );
            });
            for (const row of rows) {
                if (row.type !== "record") {
                    continue;
                }
                const rect = rects[row.record.id];
                if (rect) {
                    parts.push(this._renderBar(row.record, rect));
                }
            }
            parts.push(this._renderTodayLine());
            // The rows and the arrow overlay are both absolutely positioned, so
            // they add nothing to the height of the canvas. Without an explicit
            // height the pane would never scroll vertically.
            this.$el
                .find(".o_ssi_gantt_canvas")
                .css("height", HEADER_H + rows.length * ROW_H + "px");
            this.$el
                .find(".o_ssi_gantt_rows")
                .css({
                    top: HEADER_H + "px",
                    width: ts.totalWidth + "px",
                    height: rows.length * ROW_H + "px",
                })
                .html(parts.join(""));
            this._bindBars(rects, intervals);
        },

        /**
         * @private
         * @returns {String}
         */
        _renderTodayLine: function () {
            const x = Math.round(
                ganttUtils.dateToPx(this.timescale, ganttUtils.nowDisplayMoment())
            );
            if (x < 0 || x > this.timescale.totalWidth) {
                return "";
            }
            return (
                '<div class="o_ssi_gantt_today_line" style="left:' + x + 'px;"></div>'
            );
        },

        /**
         * @private
         * @param {Object} record
         * @param {Object} rect
         * @returns {String} the markup of one bar
         */
        _renderBar: function (record, rect) {
            const classes = ["o_ssi_gantt_bar"];
            if (rect.milestone) {
                classes.push("o_ssi_gantt_milestone");
            }
            if (this.cfg.color) {
                classes.push("o_ssi_gantt_color_" + this._colorIndex(record));
            }
            for (const decoration of DECORATIONS) {
                if (this._evalDecoration(decoration, record)) {
                    classes.push("o_ssi_gantt_decoration_" + decoration);
                }
            }
            let content = "";
            if (!rect.milestone) {
                if (this.cfg.progress) {
                    const progress = Math.min(
                        100,
                        Math.max(0, record[this.cfg.progress] || 0)
                    );
                    content +=
                        '<div class="o_ssi_gantt_progress" style="width:' +
                        progress +
                        '%;"></div>';
                }
                content +=
                    '<span class="o_ssi_gantt_bar_label">' +
                    _.escape(record.display_name || "") +
                    "</span>";
            }
            return (
                '<div class="' +
                classes.join(" ") +
                '" data-id="' +
                record.id +
                '" style="left:' +
                rect.x +
                "px;top:" +
                rect.y +
                "px;width:" +
                rect.w +
                "px;height:" +
                rect.h +
                'px;">' +
                content +
                "</div>"
            );
        },

        /**
         * @private
         * @param {Object} record
         * @returns {Number} the color index of a record
         */
        _colorIndex: function (record) {
            const raw = record[this.cfg.color];
            const value = Array.isArray(raw) ? raw[0] : raw;
            const number = Number(value) || 0;
            return Math.abs(number) % COLOR_COUNT;
        },

        /**
         * @private
         * @param {String} decoration
         * @param {Object} record
         * @returns {Boolean}
         */
        _evalDecoration: function (decoration, record) {
            const expression = this.decorations[decoration];
            if (!expression) {
                return false;
            }
            return py.PY_isTrue(py.evaluate(expression, this._evalContext(record)));
        },

        /**
         * @private
         * @param {Object} record
         * @returns {Object} the context a decoration expression is evaluated in
         */
        _evalContext: function (record) {
            const context = _.extend({}, session.user_context, {
                uid: session.uid,
                today: moment().format("YYYY-MM-DD"),
                now: moment().format("YYYY-MM-DD HH:mm:ss"),
            });
            for (const name of Object.keys(record)) {
                const field = this.fields[name];
                const value = record[name];
                if (field && field.type === "many2one" && Array.isArray(value)) {
                    context[name] = value.length ? value[0] : false;
                } else {
                    context[name] = value;
                }
            }
            return context;
        },

        /**
         * @private
         * @param {Object} rects
         * @param {Object} intervals
         */
        _bindBars: function (rects, intervals) {
            const $bars = this.$el.find(".o_ssi_gantt_bar");
            $bars.on("click", (event) => {
                const id = parseInt($(event.currentTarget).data("id"), 10);
                this.trigger_up("ssiGanttOpenRecord", {id: id});
            });
            $bars.each((index, element) => {
                const $bar = $(element);
                const id = parseInt($bar.data("id"), 10);
                const record = _.find(this.state.records, (item) => item.id === id);
                if (!record) {
                    return;
                }
                $bar.popover({
                    container: "body",
                    delay: {show: 300, hide: 0},
                    html: true,
                    placement: "auto",
                    trigger: "hover",
                    boundary: "viewport",
                    content: this._tooltipContent(record, intervals[id]),
                });
            });
            this.$poppedBars = $bars;
        },

        /**
         * @private
         * @param {Object} record
         * @param {Object} interval
         * @returns {String} the markup shown in the popover of a bar
         */
        _tooltipContent: function (record, interval) {
            const context = {
                record: record,
                field_utils: field_utils,
                widget: this,
                start: interval.start.format("LLL"),
                finish: interval.finish.format("LLL"),
                milestone: interval.milestone,
            };
            if (this.hasItemTemplate) {
                return this.qweb.render("gantt-item", context);
            }
            return qweb.render("ssi_web_gantt.ItemTooltip", context);
        },

        /**
         * A Bootstrap popover attached to ``body`` outlives the element that
         * opened it, so every bar has to be disposed of explicitly.
         *
         * @private
         */
        _disposePopovers: function () {
            if (this.$poppedBars && this.$poppedBars.length) {
                this.$poppedBars.popover("dispose");
            }
            this.$poppedBars = $();
        },

        /**
         * Build the whole arrow overlay as a single string and inject it once.
         * Appending each arrow separately would cost one reflow per arrow.
         *
         * @private
         * @param {Object} rects
         * @param {Object} intervals
         */
        _renderArrows: function (rects, intervals) {
            const parts = [qweb.render("ssi_web_gantt.ArrowDefs")];
            for (const link of this.state.links || []) {
                const predRect = rects[link.predecessor];
                const succRect = rects[link.successor];
                if (!predRect || !succRect) {
                    continue;
                }
                parts.push(
                    this._renderArrow(
                        link,
                        predRect,
                        succRect,
                        intervals[link.predecessor],
                        intervals[link.successor]
                    )
                );
            }
            const height = this.$el.find(".o_ssi_gantt_rows").height() || 0;
            const $svg = this.$el.find(".o_ssi_gantt_arrows");
            $svg.attr({
                width: this.timescale.totalWidth,
                height: height,
                viewBox: "0 0 " + this.timescale.totalWidth + " " + height,
            });
            $svg.css("top", HEADER_H + "px");
            $svg.empty();
            // A string handed to $svg.html() would be parsed as HTML and yield
            // elements in the HTML namespace, which never paint. Round-tripping
            // it through an <svg> wrapper makes the parser build real SVG nodes.
            const parsed = $.parseHTML(
                '<svg xmlns="http://www.w3.org/2000/svg">' + parts.join("") + "</svg>"
            );
            if (parsed.length) {
                const wrapper = parsed[0];
                while (wrapper.childNodes.length) {
                    $svg[0].appendChild(wrapper.childNodes[0]);
                }
            }
        },

        /**
         * @private
         * @param {Object} link
         * @param {Object} predRect
         * @param {Object} succRect
         * @param {Object} predInterval
         * @param {Object} succInterval
         * @returns {String} the markup of one arrow
         */
        _renderArrow: function (link, predRect, succRect, predInterval, succInterval) {
            const type = ganttUtils.normalizeDepType(
                link.rawType,
                this.cfg.dependencyTypeMap,
                this.cfg.dependencyTypeDefault,
                this.warnedTypes
            );
            const arrow = ganttArrow.buildArrow(
                {
                    type: type,
                    lag: link.lag,
                    lagUnit: this.cfg.dependencyLagUnit,
                },
                predRect,
                succRect,
                predInterval,
                succInterval,
                LAYOUT
            );
            const marker = arrow.violated
                ? "ssi_gantt_arrowhead_danger"
                : "ssi_gantt_arrowhead";
            const classes =
                "o_ssi_gantt_arrow" +
                (arrow.violated ? " o_ssi_gantt_arrow_danger" : "");
            let markup =
                '<path class="' +
                classes +
                '" d="' +
                arrow.path +
                '" marker-end="url(#' +
                marker +
                ')"><title>' +
                _.escape(arrow.title) +
                "</title></path>";
            if (arrow.label) {
                markup +=
                    '<text class="o_ssi_gantt_arrow_label" x="' +
                    arrow.label.x +
                    '" y="' +
                    (arrow.label.y - 4) +
                    '" text-anchor="middle">' +
                    _.escape(arrow.label.text) +
                    "</text>";
            }
            return markup;
        },

        /**
         * The right pane is the only scroller; the sidebar follows it with a
         * transform, which the compositor can handle on its own.
         *
         * @private
         */
        _syncSidebarScroll: function () {
            const pane = this.el.querySelector(".o_ssi_gantt_pane");
            const body = this.el.querySelector(".o_ssi_gantt_sidebar_body");
            if (!pane || !body) {
                return;
            }
            body.style.transform = "translateY(" + -pane.scrollTop + "px)";
        },
    });

    return GanttRenderer;
});
