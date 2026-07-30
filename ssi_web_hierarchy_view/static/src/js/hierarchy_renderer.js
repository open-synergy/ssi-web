/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyRenderer", function (require) {
    "use strict";

    const AbstractRenderer = require("web.AbstractRenderer");
    const core = require("web.core");
    const field_utils = require("web.field_utils");

    const qweb = core.qweb;

    // Horizontal indentation added per hierarchy level, in pixels.
    const INDENT_PX = 20;

    const HierarchyRenderer = AbstractRenderer.extend({
        events: _.extend({}, AbstractRenderer.prototype.events, {
            "click .o_hierarchy_toggle": "_onToggleClick",
            "click .o_hierarchy_row": "_onRowClick",
        }),

        /**
         * @override
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.columns = params.columns;
            this.fields = params.fields;
        },

        // --------------------------------------------------------------------
        // Public
        // --------------------------------------------------------------------

        /**
         * Preserves the scroll position of the table across a re-render, so
         * that opening or closing a distant node does not jump the viewport
         * back to the top.
         *
         * @override
         */
        getLocalState: function () {
            return {scrollTop: this.el.scrollTop};
        },

        /**
         * @override
         */
        setLocalState: function (localState) {
            if (localState) {
                this.el.scrollTop = localState.scrollTop || 0;
            }
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * @override
         */
        _renderView: function () {
            const rows = this._visibleRows();
            this.$el.empty().addClass("o_hierarchy_view");
            if (!this.state.rootCount) {
                this.$el.append(qweb.render("ssi_web_hierarchy_view.Empty"));
                return this._super.apply(this, arguments);
            }
            this.$el.append(
                qweb.render("ssi_web_hierarchy_view.Table", {
                    columns: this.columns,
                    rows: rows,
                    widget: this,
                })
            );
            return this._super.apply(this, arguments);
        },

        /**
         * Flattens the tree into the ordered list of rows actually drawn: a
         * row is visible when every one of its ancestors is open.
         *
         * @private
         * @returns {Array}
         */
        _visibleRows: function () {
            const byKey = this.state.rows;
            const result = [];
            const walk = (keys) => {
                for (const key of keys) {
                    const row = byKey[key];
                    if (!row) {
                        continue;
                    }
                    result.push(row);
                    if (row.isOpen && row.childKeys && row.childKeys.length) {
                        walk(row.childKeys);
                    }
                }
            };
            walk(this.state.rootKeys);
            return result;
        },

        /**
         * The indentation width of one row, used inline in the QWeb
         * template since SCSS cannot depend on a dynamic level.
         *
         * @param {Object} row
         * @returns {Number}
         */
        indentWidth: function (row) {
            return row.level * INDENT_PX;
        },

        /**
         * Tells a row matching the active filter apart from a row only
         * present because it is an ancestor of a match. Returns nothing
         * outside search mode: in the full tree every row is equal.
         *
         * @param {Object} row
         * @returns {String} the extra class of the row element
         */
        rowClass: function (row) {
            if (!this.state.searchMode) {
                return "";
            }
            return row.isMatch ? "o_hierarchy_match" : "o_hierarchy_context";
        },

        /**
         * @param {Object} row
         * @returns {String} the fontawesome class of the expand/collapse
         *      toggle
         */
        toggleIconClass: function (row) {
            return row.isOpen ? "fa-caret-down" : "fa-caret-right";
        },

        /**
         * The value shown in the hierarchy column: the first configured
         * column when there is one, ``display_name`` otherwise.
         *
         * @param {Object} row
         * @returns {String}
         */
        mainLabel: function (row) {
            if (this.columns.length) {
                return this.formatCell(row, this.columns[0]);
            }
            return row.data.display_name || "";
        },

        /**
         * Formats one cell of a row for display, using the same formatters
         * a list view uses.
         *
         * @param {Object} row
         * @param {Object} column
         * @returns {String}
         */
        formatCell: function (row, column) {
            const field = this.fields[column.name];
            const value = row.data[column.name];
            if (!field) {
                return "";
            }
            const formatter = field_utils.format[field.type];
            if (formatter) {
                return formatter(value, field);
            }
            return value === false || value === undefined ? "" : String(value);
        },

        // --------------------------------------------------------------------
        // Handlers
        // --------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} event
         */
        _onToggleClick: function (event) {
            event.stopPropagation();
            const key = $(event.currentTarget).closest(".o_hierarchy_row").data("key");
            this.trigger_up("hierarchy_toggle_node", {rowKey: key});
        },

        /**
         * @private
         * @param {MouseEvent} event
         */
        _onRowClick: function (event) {
            const key = $(event.currentTarget).data("key");
            const row = this.state.rows[key];
            if (row) {
                this.trigger_up("hierarchy_open_record", {id: row.id});
            }
        },
    });

    return HierarchyRenderer;
});
