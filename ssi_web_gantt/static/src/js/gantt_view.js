/* global py */
/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.GanttView", function (require) {
    "use strict";

    const AbstractView = require("web.AbstractView");
    const core = require("web.core");
    const pyUtils = require("web.py_utils");
    const session = require("web.session");
    const view_registry = require("web.view_registry");
    const GanttController = require("ssi_web_gantt.GanttController");
    const GanttModel = require("ssi_web_gantt.GanttModel");
    const GanttRenderer = require("ssi_web_gantt.GanttRenderer");
    const ganttUtils = require("ssi_web_gantt.gantt_utils");

    const _lt = core._lt;

    const SCALE_LABELS = {
        day: _lt("Day"),
        week: _lt("Week"),
        month: _lt("Month"),
        quarter: _lt("Quarter"),
        year: _lt("Year"),
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

    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 4;

    /**
     * @param {String} value an arch attribute
     * @param {Boolean} fallback
     * @returns {Boolean}
     */
    function toBool(value, fallback) {
        if (value === undefined || value === null || value === "") {
            return fallback;
        }
        return value !== "0" && value !== "false" && value !== "False";
    }

    const GanttView = AbstractView.extend({
        display_name: _lt("Gantt"),
        icon: "fa-tasks",
        // No jsLibs and no cssLibs: rendering the chart without any third party
        // library is the entire point of this module.
        config: _.extend({}, AbstractView.prototype.config, {
            Model: GanttModel,
            Controller: GanttController,
            Renderer: GanttRenderer,
        }),
        // AbstractController reads this to build the controller state, and thus
        // the view_type of the URL. Leaving it unset breaks the URL silently.
        viewType: "ssi_gantt",
        multi_record: true,
        searchMenuTypes: ["filter", "groupBy", "favorite"],

        /**
         * @override
         */
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);
            const attrs = this.arch.attrs;
            const fields = viewInfo.fields;

            const cfg = this._buildConfig(attrs, fields);
            const scales = this._parseScales(attrs.scales);
            const defaultScale = this._parseDefaultScale(attrs.default_scale, scales);
            const defaultZoom = Math.min(
                ZOOM_MAX,
                Math.max(ZOOM_MIN, parseFloat(attrs.default_zoom) || 1)
            );
            const decorations = this._parseDecorations(attrs);
            const defaultGroupBy = this._parseDefaultGroupBy(attrs.default_group_by);

            this.rendererParams.cfg = cfg;
            this.rendererParams.fields = fields;
            this.rendererParams.arch = this.arch;
            this.rendererParams.modelName = this.controllerParams.modelName;
            this.rendererParams.defaultScale = defaultScale;
            this.rendererParams.defaultZoom = defaultZoom;
            this.rendererParams.decorations = decorations;
            this.rendererParams.scales = scales;

            this.loadParams.modelName = this.controllerParams.modelName;
            this.loadParams.fieldNames = this._fieldNames(cfg, defaultGroupBy);
            this.loadParams.fields = fields;
            this.loadParams.cfg = cfg;
            this.loadParams.defaultGroupBy = defaultGroupBy;

            this.controllerParams.defaultScale = defaultScale;
            this.controllerParams.defaultZoom = defaultZoom;
            this.controllerParams.scales = scales;
            this.controllerParams.scaleLabels = SCALE_LABELS;
            this.controllerParams.openPopupAction = attrs.event_open_popup;
            this.controllerParams.actionContext = params.action
                ? params.action.context
                : {};

            this.withSearchPanel = false;
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * @private
         * @param {Object} attrs the arch attributes
         * @param {Object} fields viewInfo.fields
         * @returns {Object} everything the model and the renderer need to know
         *      about the arch
         */
        _buildConfig: function (attrs, fields) {
            const stopField = fields[attrs.date_stop] || {};
            const cfg = {
                dateStart: attrs.date_start,
                dateStop: attrs.date_stop,
                dateDelay: attrs.date_delay,
                delayUnit: attrs.delay_unit === "days" ? "days" : "hours",
                dateStopInclusive: toBool(
                    attrs.date_stop_inclusive,
                    stopField.type === "date"
                ),
                progress: attrs.progress,
                color: attrs.color,
                dependencyModel: attrs.dependency_model,
                dependencyPredecessorField: attrs.dependency_predecessor_field,
                dependencySuccessorField: attrs.dependency_successor_field,
                dependencyTypeField: attrs.dependency_type_field,
                dependencyLagField: attrs.dependency_lag_field,
                dependencyLagUnit:
                    attrs.dependency_lag_unit === "hours" ? "hours" : "days",
                dependencyDomain: this._parseDependencyDomain(attrs.dependency_domain),
                dependencyTypeMap: ganttUtils.parseTypeMap(attrs.dependency_type_map),
                dependencyTypeDefault: attrs.dependency_type_default || "fs",
                dependencyField: attrs.dependency_field,
                dependencyFieldDirection:
                    attrs.dependency_field_direction === "successor"
                        ? "successor"
                        : "predecessor",
            };
            if (cfg.dependencyModel && cfg.dependencyField) {
                console.warn(
                    "ssi_web_gantt: dependency_model and dependency_field are both " +
                        "set; dependency_field is ignored."
                );
                cfg.dependencyField = false;
            }
            return cfg;
        },

        /**
         * @private
         * @param {String} expression
         * @returns {Array} the additional domain applied to the link model
         */
        _parseDependencyDomain: function (expression) {
            if (!expression) {
                return [];
            }
            const context = _.extend({}, session.user_context, {
                uid: session.uid,
                context: session.user_context,
                today: moment().format("YYYY-MM-DD"),
                now: moment().format("YYYY-MM-DD HH:mm:ss"),
            });
            try {
                return pyUtils.eval("domain", expression, context);
            } catch (error) {
                console.warn(
                    "ssi_web_gantt: cannot evaluate dependency_domain " +
                        expression +
                        "; it is ignored.",
                    error
                );
                return [];
            }
        },

        /**
         * @private
         * @param {String} requested the default_scale arch attribute
         * @param {Array} scales the scales the arch allows
         * @returns {String}
         */
        _parseDefaultScale: function (requested, scales) {
            if (requested && scales.includes(requested)) {
                return requested;
            }
            if (scales.includes("month")) {
                return "month";
            }
            return scales[0];
        },

        /**
         * @private
         * @param {String} expression
         * @returns {Array}
         */
        _parseScales: function (expression) {
            if (!expression) {
                return ganttUtils.SCALE_NAMES.slice();
            }
            const scales = expression
                .split(",")
                .map((scale) => scale.trim())
                .filter((scale) => ganttUtils.SCALE_NAMES.includes(scale));
            return scales.length ? scales : ganttUtils.SCALE_NAMES.slice();
        },

        /**
         * Only the first group by is honoured, which is a documented limitation
         * of this iteration.
         *
         * @private
         * @param {String} expression
         * @returns {Array}
         */
        _parseDefaultGroupBy: function (expression) {
            if (!expression) {
                return [];
            }
            const groupBy = expression
                .split(",")
                .map((name) => name.trim())
                .filter((name) => name);
            return groupBy.length ? [groupBy[0]] : [];
        },

        /**
         * @private
         * @param {Object} attrs
         * @returns {Object} the compiled decoration expressions
         */
        _parseDecorations: function (attrs) {
            const decorations = {};
            for (const decoration of DECORATIONS) {
                const expression = attrs["decoration-" + decoration];
                if (expression) {
                    decorations[decoration] = py.parse(py.tokenize(expression));
                }
            }
            return decorations;
        },

        /**
         * Every field the chart reads has to be fetched by search_read. The
         * fields used in a decoration expression are already declared as
         * <field> children, because the server refuses the arch otherwise.
         *
         * @private
         * @param {Object} cfg
         * @param {Array} defaultGroupBy
         * @returns {Array}
         */
        _fieldNames: function (cfg, defaultGroupBy) {
            const names = ["display_name"];
            const attributes = [
                cfg.dateStart,
                cfg.dateStop,
                cfg.dateDelay,
                cfg.progress,
                cfg.color,
                cfg.dependencyField,
            ];
            for (const name of attributes) {
                if (name) {
                    names.push(name);
                }
            }
            for (const child of this.arch.children) {
                if (child.tag === "field" && child.attrs.name) {
                    names.push(child.attrs.name);
                }
            }
            for (const name of defaultGroupBy || []) {
                names.push(name.split(":")[0]);
            }
            return _.uniq(names);
        },
    });

    view_registry.add("ssi_gantt", GanttView);

    return GanttView;
});
