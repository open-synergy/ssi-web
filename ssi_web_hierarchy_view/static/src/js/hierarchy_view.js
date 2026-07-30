/* global py */
/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyView", function (require) {
    "use strict";

    const AbstractView = require("web.AbstractView");
    const core = require("web.core");
    const view_registry = require("web.view_registry");
    const HierarchyController = require("ssi_web_hierarchy_view.HierarchyController");
    const HierarchyModel = require("ssi_web_hierarchy_view.HierarchyModel");
    const HierarchyRenderer = require("ssi_web_hierarchy_view.HierarchyRenderer");

    const _lt = core._lt;

    const DEFAULT_EXPAND = 0;
    const DEFAULT_LIMIT = 1000;

    // Row decorations the hierarchy tag accepts, exactly the ones
    // ssi_web_gantt accepts. The order is the order the classes are applied
    // in, so a decoration listed later wins over an earlier one whenever
    // several of them light up on the same row.
    const DECORATIONS = [
        "danger",
        "warning",
        "info",
        "success",
        "primary",
        "secondary",
        "muted",
    ];

    // Names read by a decoration expression. String literals are stripped
    // before the match, so that a quoted word never passes for a field.
    const IDENTIFIER_RE = /[A-Za-z_]\w*/g;
    const STRING_LITERAL_RE = /'[^']*'|"[^"]*"/g;

    // Field types a column may ask a subtree total for, exactly the ones a
    // list view aggregates. The server rejects any other one when the view
    // is saved; the same list is applied here so that an arch stored before
    // that check existed cannot break the browser.
    const AGGREGATABLE_TYPES = ["integer", "float", "monetary"];

    // The currency field a monetary field falls back to when it declares
    // none of its own, the same fallback field_utils applies.
    const DEFAULT_CURRENCY_FIELD = "currency_id";

    const HierarchyView = AbstractView.extend({
        display_name: _lt("Hierarchy"),
        icon: "fa-sitemap",
        config: _.extend({}, AbstractView.prototype.config, {
            Model: HierarchyModel,
            Controller: HierarchyController,
            Renderer: HierarchyRenderer,
        }),
        // AbstractController reads this to build the controller state, and
        // thus the view_type of the URL. Leaving it unset breaks the URL
        // silently.
        viewType: "hierarchy",
        multi_record: true,
        // No groupBy: grouping records would collide with the hierarchy
        // itself, which is already a grouping of sorts.
        searchMenuTypes: ["filter", "favorite"],

        /**
         * @override
         */
        init: function (viewInfo) {
            this._super.apply(this, arguments);
            const attrs = this.arch.attrs;
            const fields = viewInfo.fields;

            const columns = this._buildColumns(fields);
            const childField = attrs.child_field || false;
            const parentField = attrs.parent_field || false;
            const defaultExpand = parseInt(attrs.default_expand, 10) || DEFAULT_EXPAND;
            const limit = parseInt(attrs.limit, 10) || DEFAULT_LIMIT;

            this.rendererParams.columns = columns;
            this.rendererParams.fields = fields;
            this.rendererParams.decorations = this._parseDecorations(attrs);

            this.loadParams.modelName = this.controllerParams.modelName;
            this.loadParams.fieldNames = this._fieldNames(
                columns,
                childField,
                parentField,
                fields
            );
            this.loadParams.childField = childField;
            this.loadParams.parentField = parentField;
            this.loadParams.defaultExpand = defaultExpand;
            this.loadParams.limit = limit;
            this.loadParams.aggregateFieldNames = this._aggregateFieldNames(
                columns,
                fields
            );

            this.withSearchPanel = false;
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * The first ``<field>`` child of the arch is the hierarchy column
         * (indentation + toggle); every other one is a plain column.
         * Without any ``<field>`` at all, the hierarchy column falls back
         * to ``display_name`` in the renderer.
         *
         * @private
         * @param {Object} fields viewInfo.fields
         * @returns {Array} [{name, label, sum}]
         */
        _buildColumns: function (fields) {
            const columns = [];
            for (const child of this.arch.children) {
                if (child.tag === "field" && child.attrs.name) {
                    const field = fields[child.attrs.name] || {};
                    columns.push({
                        name: child.attrs.name,
                        label: child.attrs.string || field.string || child.attrs.name,
                        // The label of the grand total row, spelled the
                        // same way a list view spells it. False when the
                        // column asks for no total at all.
                        sum: child.attrs.sum || false,
                    });
                }
            }
            return columns;
        },

        /**
         * The columns whose subtree total the model has to ask the server
         * for. A column asking for a total on a field the browser cannot
         * aggregate is dropped rather than sent: the server would refuse
         * the whole call and the tree would show nothing at all.
         *
         * @private
         * @param {Array} columns
         * @param {Object} fields viewInfo.fields
         * @returns {Array} the names of the aggregated fields
         */
        _aggregateFieldNames: function (columns, fields) {
            const names = [];
            for (const column of columns) {
                const field = fields[column.name];
                if (!column.sum || !field) {
                    continue;
                }
                if (AGGREGATABLE_TYPES.includes(field.type) && field.store) {
                    names.push(column.name);
                }
            }
            return _.uniq(names);
        },

        /**
         * The currency fields the monetary totals are formatted with: the
         * ``currency_field`` each monetary column declares itself. They
         * are usually no column of the tree, so nothing else fetches them.
         *
         * @private
         * @param {Array} columns
         * @param {Object} fields viewInfo.fields
         * @returns {Array}
         */
        _currencyFieldNames: function (columns, fields) {
            const names = [];
            for (const name of this._aggregateFieldNames(columns, fields)) {
                const field = fields[name];
                if (field.type !== "monetary") {
                    continue;
                }
                const currencyField = field.currency_field || DEFAULT_CURRENCY_FIELD;
                if (fields[currencyField]) {
                    names.push(currencyField);
                }
            }
            return names;
        },

        /**
         * Every field the tree reads has to be fetched by search_read/read:
         * the columns, plus ``child_field``/``parent_field`` themselves so
         * the model can tell whether a row has children and, in
         * ``child_field`` mode, read them without an extra search, plus the
         * fields a decoration expression reads and the currency field of a
         * monetary total, which are usually no column at all.
         *
         * @private
         * @param {Array} columns
         * @param {String|Boolean} childField
         * @param {String|Boolean} parentField
         * @param {Object} fields viewInfo.fields
         * @returns {Array}
         */
        _fieldNames: function (columns, childField, parentField, fields) {
            const names = ["display_name"];
            for (const column of columns) {
                names.push(column.name);
            }
            if (childField) {
                names.push(childField);
            }
            if (parentField) {
                names.push(parentField);
            }
            for (const name of this._decorationFieldNames(fields)) {
                names.push(name);
            }
            for (const name of this._currencyFieldNames(columns, fields)) {
                names.push(name);
            }
            return _.uniq(names);
        },

        /**
         * Compiles the ``decoration-*`` attributes of the arch once, so
         * that the renderer only ever evaluates an already parsed
         * expression, once per row and per decoration.
         *
         * @private
         * @param {Object} attrs the arch attributes
         * @returns {Object} compiled expressions, keyed by decoration
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
         * The fields read by the decoration expressions. The server
         * registers every one of them on the view, so a name is taken for
         * a field exactly when it is one of the view's own fields; a
         * symbol of the evaluation context (``uid``, ``today``, ...) never
         * is.
         *
         * @private
         * @param {Object} fields viewInfo.fields
         * @returns {Array}
         */
        _decorationFieldNames: function (fields) {
            const names = [];
            for (const decoration of DECORATIONS) {
                const expression = this.arch.attrs["decoration-" + decoration];
                if (!expression) {
                    continue;
                }
                const tokens =
                    expression.replace(STRING_LITERAL_RE, " ").match(IDENTIFIER_RE) ||
                    [];
                for (const token of tokens) {
                    if (fields[token]) {
                        names.push(token);
                    }
                }
            }
            return names;
        },
    });

    view_registry.add("hierarchy", HierarchyView);

    return HierarchyView;
});
