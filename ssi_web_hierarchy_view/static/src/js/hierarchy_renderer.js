/* global py */
/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyRenderer", function (require) {
    "use strict";

    const AbstractRenderer = require("web.AbstractRenderer");
    const core = require("web.core");
    const field_utils = require("web.field_utils");
    const session = require("web.session");

    const qweb = core.qweb;

    // Horizontal indentation added per hierarchy level, in pixels.
    const INDENT_PX = 20;

    // Class carried by a cell showing a subtree total instead of the value
    // of the record itself, so that a total can be told apart from a value
    // and restyled by a database without touching this module.
    const AGGREGATE_CLASS = "o_hierarchy_aggregate";

    // The currency field a monetary field falls back to when it declares
    // none of its own, the same fallback field_utils applies.
    const DEFAULT_CURRENCY_FIELD = "currency_id";

    /**
     * @param {*} value a many2one value read by search_read/read, either
     *      false or a [id, display_name] pair
     * @returns {Number|Boolean} the id it carries, false when empty
     */
    function toId(value) {
        if (Array.isArray(value)) {
            return value.length ? value[0] : false;
        }
        return value || false;
    }

    // Row decorations, in the order their classes are applied: a decoration
    // listed later wins over an earlier one whenever several of them light
    // up on the same row. The stylesheet declares them in this very order.
    const DECORATIONS = [
        "danger",
        "warning",
        "info",
        "success",
        "primary",
        "secondary",
        "muted",
    ];

    // Keys the tree answers to. Anything else is left to the browser, so
    // that Tab, Shift+Tab and shortcuts keep working inside the view.
    const KEY_DOWN = "ArrowDown";
    const KEY_UP = "ArrowUp";
    const KEY_RIGHT = "ArrowRight";
    const KEY_LEFT = "ArrowLeft";
    const KEY_ENTER = "Enter";
    const KEY_HOME = "Home";
    const KEY_END = "End";
    const HANDLED_KEYS = [
        KEY_DOWN,
        KEY_UP,
        KEY_RIGHT,
        KEY_LEFT,
        KEY_ENTER,
        KEY_HOME,
        KEY_END,
    ];

    const HierarchyRenderer = AbstractRenderer.extend({
        events: _.extend({}, AbstractRenderer.prototype.events, {
            "click .o_hierarchy_toggle": "_onToggleClick",
            "click .o_hierarchy_row": "_onRowClick",
            "keydown .o_hierarchy_row": "_onRowKeydown",
            "focusin .o_hierarchy_row": "_onRowFocusIn",
        }),

        /**
         * @override
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.columns = params.columns;
            this.fields = params.fields;
            this.decorations = params.decorations || {};
            // The rows actually drawn, in the order they are drawn: what
            // ArrowUp/ArrowDown and Home/End walk through.
            this.visibleRows = [];
            // Roving tabindex: the one row reachable with Tab, so that Tab
            // steps over the whole tree instead of through every row.
            this.focusedKey = false;
        },

        // --------------------------------------------------------------------
        // Public
        // --------------------------------------------------------------------

        /**
         * Preserves the scroll position of the table across a re-render, so
         * that opening or closing a distant node does not jump the viewport
         * back to the top, together with the keyboard focus: opening a node
         * with ArrowRight has to leave the focus on the very row that was
         * opened.
         *
         * @override
         */
        getLocalState: function () {
            return {
                scrollTop: this.el.scrollTop,
                focusedKey: this.focusedKey,
                // Only a row that really held the browser focus is focused
                // again after the re-render: re-rendering because of a
                // mouse click must not steal the focus from elsewhere.
                hasFocus: this.$(".o_hierarchy_row:focus").length > 0,
            };
        },

        /**
         * @override
         */
        setLocalState: function (localState) {
            if (!localState) {
                return;
            }
            this.el.scrollTop = localState.scrollTop || 0;
            if (!localState.focusedKey) {
                return;
            }
            if (localState.hasFocus) {
                this._focusRow(localState.focusedKey);
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
            this.visibleRows = rows;
            this.focusedKey = this._normalizeFocusedKey(rows);
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
         * The row the roving tabindex belongs to. The row focused last as
         * long as it is still drawn, the first row otherwise, so that Tab
         * always reaches the tree at a meaningful place — including right
         * after a node was collapsed away under the focus.
         *
         * @private
         * @param {Array} rows the rows about to be drawn
         * @returns {String|Boolean}
         */
        _normalizeFocusedKey: function (rows) {
            if (!rows.length) {
                return false;
            }
            if (this.focusedKey && rows.some((row) => row.key === this.focusedKey)) {
                return this.focusedKey;
            }
            return rows[0].key;
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
         * The extra classes of a row: which decorations of the arch light
         * up on it and, in search mode only, whether it matched the filter
         * itself or is one of the ancestors dragged along with a match.
         *
         * @param {Object} row
         * @returns {String} the extra classes of the row element
         */
        rowClass: function (row) {
            const classes = [];
            if (this.state.searchMode) {
                classes.push(row.isMatch ? "o_hierarchy_match" : "o_hierarchy_context");
            }
            for (const decoration of DECORATIONS) {
                if (this._evalDecoration(decoration, row)) {
                    classes.push("o_hierarchy_row_" + decoration);
                }
            }
            return classes.join(" ");
        },

        /**
         * @private
         * @param {String} decoration
         * @param {Object} row
         * @returns {Boolean} whether the decoration lights up on that row
         */
        _evalDecoration: function (decoration, row) {
            const expression = this.decorations[decoration];
            if (!expression) {
                return false;
            }
            return py.PY_isTrue(py.evaluate(expression, this._evalContext(row.data)));
        },

        /**
         * @private
         * @param {Object} record the raw values of one row
         * @returns {Object} the context a decoration expression is
         *      evaluated in
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
         * @param {Object} row
         * @returns {Number} the ARIA level of a row, one based
         */
        ariaLevel: function (row) {
            return row.level + 1;
        },

        /**
         * @param {Object} row
         * @returns {String|undefined} ``aria-expanded`` of a row, left out
         *      entirely on a leaf: a node without children is neither open
         *      nor closed
         */
        ariaExpanded: function (row) {
            if (!row.hasChildren) {
                return undefined;
            }
            return row.isOpen ? "true" : "false";
        },

        /**
         * @param {Object} row
         * @returns {Number} how many siblings the row belongs to
         */
        ariaSetSize: function (row) {
            return this._siblingKeys(row).length || 1;
        },

        /**
         * @param {Object} row
         * @returns {Number} the position of the row among its siblings, one
         *      based
         */
        ariaPosInSet: function (row) {
            const index = this._siblingKeys(row).indexOf(row.key);
            return index === -1 ? 1 : index + 1;
        },

        /**
         * @param {Object} row
         * @returns {String} ``0`` on the one row Tab reaches, ``-1`` on
         *      every other one
         */
        rowTabIndex: function (row) {
            return row.key === this.focusedKey ? "0" : "-1";
        },

        /**
         * @private
         * @param {Object} row
         * @returns {Array} the keys of the row's own level, itself included
         */
        _siblingKeys: function (row) {
            const parent = row.parentKey ? this.state.rows[row.parentKey] : false;
            if (parent) {
                return parent.childKeys || [];
            }
            return this.state.rootKeys;
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
         * a list view uses. A column asking for a total shows the subtree
         * total on a row that has children and the row's own value on a
         * leaf.
         *
         * @param {Object} row
         * @param {Object} column
         * @returns {String}
         */
        formatCell: function (row, column) {
            const field = this.fields[column.name];
            if (!field) {
                return "";
            }
            return this._formatValue(this.cellValue(row, column), field, row.data);
        },

        /**
         * @param {Object} row
         * @param {Object} column
         * @returns {*} the raw value the cell displays: the subtree total
         *      on an aggregated parent row, the record's own value
         *      everywhere else
         */
        cellValue: function (row, column) {
            if (this.isAggregateCell(row, column)) {
                return row.aggregates[column.name];
            }
            return row.data[column.name];
        },

        /**
         * A cell shows a total only on a row that actually has children:
         * on a leaf the total would be the row's own value anyway, and
         * showing it as a total would read as if something were summed
         * underneath it.
         *
         * @param {Object} row
         * @param {Object} column
         * @returns {Boolean}
         */
        isAggregateCell: function (row, column) {
            return Boolean(
                column.sum &&
                    row.hasChildren &&
                    row.aggregates &&
                    column.name in row.aggregates
            );
        },

        /**
         * @param {Object} row
         * @param {Object} column
         * @returns {String} the extra classes of a body cell
         */
        cellClass: function (row, column) {
            return this.isAggregateCell(row, column) ? AGGREGATE_CLASS : "";
        },

        /**
         * @returns {Boolean} whether a grand total row has to be drawn at
         *      all, which is the case as soon as one column asks for a
         *      total
         */
        hasTotals: function () {
            return Object.keys(this.state.totals || {}).length > 0;
        },

        /**
         * @param {Object} column
         * @returns {Boolean} whether the grand total row holds a value in
         *      that column
         */
        hasTotal: function (column) {
            return Boolean(column.sum && column.name in (this.state.totals || {}));
        },

        /**
         * @param {Object} column
         * @returns {String} the extra classes of a grand total row cell
         */
        totalCellClass: function (column) {
            return this.hasTotal(column) ? AGGREGATE_CLASS : "";
        },

        /**
         * The label given to ``sum=`` becomes the tooltip of the grand
         * total, the same way a list view uses it. ``undefined`` rather
         * than ``false`` on a column without a total: QWeb only leaves an
         * attribute out for ``undefined``/``null``, and would otherwise
         * render ``title="false"``.
         *
         * @param {Object} column
         * @returns {String|undefined}
         */
        totalTitle: function (column) {
            return this.hasTotal(column) ? column.sum : undefined;
        },

        /**
         * The grand total of one column: the total over the union of the
         * subtrees of the roots currently on screen, every record counted
         * exactly once, so it follows the active domain and the pager.
         *
         * @param {Object} column
         * @returns {String}
         */
        formatTotal: function (column) {
            if (!this.hasTotal(column)) {
                return "";
            }
            const field = this.fields[column.name];
            if (!field) {
                return "";
            }
            return this._formatValue(
                this.state.totals[column.name],
                field,
                this._totalRowData()
            );
        },

        /**
         * @private
         * @returns {Object|Boolean} the values a monetary grand total
         *      reads its currency from: those of the first root on
         *      screen, every root of one page sharing one currency in
         *      practice
         */
        _totalRowData: function () {
            const rootKey = this.state.rootKeys[0];
            const row = rootKey ? this.state.rows[rootKey] : false;
            return row ? row.data : false;
        },

        /**
         * @private
         * @param {*} value
         * @param {Object} field the field description of the column
         * @param {Object|Boolean} data the values the row was read with,
         *      needed by a monetary column to resolve its currency
         * @returns {String}
         */
        _formatValue: function (value, field, data) {
            const formatter = field_utils.format[field.type];
            if (!formatter) {
                return value === false || value === undefined ? "" : String(value);
            }
            return formatter(value, field, this._formatOptions(field, data));
        },

        /**
         * A monetary value is formatted with the currency held by the
         * ``currency_field`` the field declares itself, which the view
         * fetches next to the column for that very reason.
         *
         * @private
         * @param {Object} field the field description of the column
         * @param {Object|Boolean} data the values the row was read with
         * @returns {Object} the options handed to the formatter
         */
        _formatOptions: function (field, data) {
            if (field.type !== "monetary" || !data) {
                return {};
            }
            const currencyField = field.currency_field || DEFAULT_CURRENCY_FIELD;
            const currencyId = toId(data[currencyField]);
            return currencyId ? {currency_id: currencyId} : {};
        },

        /**
         * @private
         * @param {String} rowKey
         * @returns {jQuery} the row element of a key, empty when that row
         *      is not drawn
         */
        _rowElement: function (rowKey) {
            return this.$(".o_hierarchy_row[data-key='" + rowKey + "']");
        },

        /**
         * Moves the keyboard focus to a row and hands it the roving
         * tabindex. A row that is not drawn is ignored, so that a focus
         * left over from a collapsed subtree cannot blur the tree.
         *
         * @private
         * @param {String} rowKey
         */
        _focusRow: function (rowKey) {
            const $row = this._rowElement(rowKey);
            if (!$row.length) {
                return;
            }
            this.focusedKey = rowKey;
            this._updateTabIndex();
            $row[0].focus();
        },

        /**
         * @private
         * @param {Number} index position in the drawn rows
         */
        _focusIndex: function (index) {
            if (index < 0 || index >= this.visibleRows.length) {
                return;
            }
            this._focusRow(this.visibleRows[index].key);
        },

        /**
         * @private
         * @param {String} rowKey the row the move starts from
         * @param {Number} delta how many rows to move, signed
         */
        _focusRelative: function (rowKey, delta) {
            const index = this.visibleRows.findIndex((row) => row.key === rowKey);
            if (index === -1) {
                return;
            }
            this._focusIndex(index + delta);
        },

        /**
         * Keeps exactly one row reachable with Tab, the focused one.
         *
         * @private
         */
        _updateTabIndex: function () {
            this.$(".o_hierarchy_row").attr("tabindex", "-1");
            this._rowElement(this.focusedKey).attr("tabindex", "0");
        },

        /**
         * Opens a closed node; on an already open one, walks down to its
         * first child instead.
         *
         * @private
         * @param {Object} row
         */
        _keyboardExpand: function (row) {
            if (row.hasChildren && !row.isOpen) {
                this.trigger_up("hierarchy_toggle_node", {rowKey: row.key});
                return;
            }
            if (row.isOpen && row.childKeys && row.childKeys.length) {
                this._focusRow(row.childKeys[0]);
            }
        },

        /**
         * Closes an open node; on an already closed one, walks up to its
         * parent instead.
         *
         * @private
         * @param {Object} row
         */
        _keyboardCollapse: function (row) {
            if (row.isOpen) {
                this.trigger_up("hierarchy_toggle_node", {rowKey: row.key});
                return;
            }
            if (row.parentKey && this.state.rows[row.parentKey]) {
                this._focusRow(row.parentKey);
            }
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

        /**
         * Walks the tree from the keyboard. The focus stays on rows, never
         * on cells, and only the keys of the contract are swallowed: every
         * other one, Tab included, is left to the browser.
         *
         * @private
         * @param {KeyboardEvent} event
         */
        _onRowKeydown: function (event) {
            if (!HANDLED_KEYS.includes(event.key)) {
                return;
            }
            const key = $(event.currentTarget).data("key");
            const row = this.state.rows[key];
            if (!row) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            switch (event.key) {
                case KEY_DOWN:
                    this._focusRelative(key, 1);
                    break;
                case KEY_UP:
                    this._focusRelative(key, -1);
                    break;
                case KEY_RIGHT:
                    this._keyboardExpand(row);
                    break;
                case KEY_LEFT:
                    this._keyboardCollapse(row);
                    break;
                case KEY_ENTER:
                    this.trigger_up("hierarchy_open_record", {id: row.id});
                    break;
                case KEY_HOME:
                    this._focusIndex(0);
                    break;
                case KEY_END:
                    this._focusIndex(this.visibleRows.length - 1);
                    break;
                // No default: HANDLED_KEYS has no other member.
            }
        },

        /**
         * Hands the roving tabindex over to whichever row took the focus,
         * so that a row reached with Tab or with the mouse becomes the one
         * the arrow keys start from.
         *
         * @private
         * @param {FocusEvent} event
         */
        _onRowFocusIn: function (event) {
            const key = $(event.currentTarget).data("key");
            if (!this.state.rows[key] || key === this.focusedKey) {
                return;
            }
            this.focusedKey = key;
            this._updateTabIndex();
        },
    });

    return HierarchyRenderer;
});
