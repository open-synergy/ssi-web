// Copyright 2025 OpenSynergy Indonesia
// Copyright 2025 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).
odoo.define("ssi_web_list_drag_scroll.ListRenderer", function (require) {
    "use strict";

    var ListRenderer = require("web.ListRenderer");
    var ListView = require("web.ListView");
    var pyUtils = require("web.py_utils");
    var viewRegistry = require("web.view_registry");

    var JS_CLASS = "drag_scroll_list";
    var STORAGE_PREFIX = "ssi_web_list_drag_scroll:";
    // Pixels the pointer must travel before a press becomes a drag.
    var DRAG_THRESHOLD = 5;
    // A press starting on one of these keeps its normal behaviour.
    var IGNORE_SELECTOR = [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        "label",
        ".o_ssi_lock_toggle",
        ".o_resize",
        ".o_row_handle",
        ".o_selected_row",
        ".o_optional_columns_dropdown",
        ".o_optional_columns_dropdown_toggle",
        ".dropdown-menu",
    ].join(",");

    // Lets `js_class="drag_scroll_list"` resolve for standalone list views.
    viewRegistry.add(JS_CLASS, ListView);

    function readStoredLock(key) {
        try {
            var value = window.localStorage.getItem(STORAGE_PREFIX + key);
            return value === null ? null : value === "1";
        } catch (e) {
            return null;
        }
    }

    function writeStoredLock(key, locked) {
        try {
            window.localStorage.setItem(STORAGE_PREFIX + key, locked ? "1" : "0");
        } catch (e) {
            // Storage unavailable: the choice only lasts until the next render.
        }
    }

    /**
     * Find the closest ancestor that can really scroll along one axis.
     *
     * @param {Element} el: Element to start from
     * @param {String} axis: "x" or "y"
     * @returns {Element|null}
     */
    function getScrollParent(el, axis) {
        var node = el;
        while (node && node !== document.body) {
            var style = window.getComputedStyle(node);
            var overflow = axis === "x" ? style.overflowX : style.overflowY;
            var scrollable =
                axis === "x"
                    ? node.scrollWidth > node.clientWidth + 1
                    : node.scrollHeight > node.clientHeight + 1;
            if (/(auto|scroll)/.test(overflow) && scrollable) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    ListRenderer.include({
        /**
         * @returns {Boolean}: True if the view opted in with the js_class
         */
        _isDragScrollEnabled: function () {
            return Boolean(
                this.arch && this.arch.attrs && this.arch.attrs.js_class === JS_CLASS
            );
        },

        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this._ssiDrag = null;
            this._ssiResizeObserver = null;
            this._ssiOnMouseMove = this._onSsiDragMove.bind(this);
            this._ssiOnMouseUp = this._onSsiDragEnd.bind(this);
            this._ssiBlockEvent = function (ev) {
                ev.preventDefault();
            };
        },

        /**
         * @override
         */
        start: function () {
            if (this._isDragScrollEnabled()) {
                this.el.classList.add("o_ssi_drag_scroll");
                this.el.addEventListener("mousedown", this._onSsiDragStart.bind(this));
                this.el.addEventListener(
                    "click",
                    this._onSsiLockToggle.bind(this),
                    true
                );
            }
            return this._super.apply(this, arguments);
        },

        /**
         * @override
         */
        destroy: function () {
            this._ssiStopDrag();
            if (this._ssiResizeObserver) {
                this._ssiResizeObserver.disconnect();
            }
            this._super.apply(this, arguments);
        },

        /**
         * @override
         */
        on_attach_callback: function () {
            this._super.apply(this, arguments);
            if (this._isDragScrollEnabled()) {
                this._ssiApplyLocks();
                this._ssiMoveOptionalToggle();
            }
        },

        /**
         * @override
         */
        _renderView: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function (result) {
                if (self._isDragScrollEnabled()) {
                    self._ssiObserveTable();
                    self._ssiApplyLocks();
                    self._ssiMoveOptionalToggle();
                }
                return result;
            });
        },

        /**
         * Puts the locked columns first, so they sit side by side at the left
         * edge. A sticky cell only sticks once it is scrolled to its offset,
         * which a locked column far to the right might never reach. Unlocking
         * restores the order of the view, as it is always derived from it.
         *
         * @override
         */
        _processColumns: function () {
            this._super.apply(this, arguments);
            if (!this._isDragScrollEnabled()) {
                return;
            }
            var self = this;
            var locked = [];
            var others = [];
            this.columns.forEach(function (node) {
                if (node.tag === "field" && self._ssiIsLocked(node)) {
                    locked.push(node);
                } else {
                    others.push(node);
                }
            });
            this.columns = locked.concat(others);
        },

        /**
         * Adds the lock toggle to the header of every field column.
         *
         * @override
         */
        _renderHeaderCell: function (node) {
            var $th = this._super.apply(this, arguments);
            if (this._isDragScrollEnabled() && node.tag === "field") {
                // Left side: the right edge of a header holds the column resize
                // handle, which would otherwise cover the pin.
                $th.prepend(
                    $("<i/>", {
                        class: "fa fa-thumb-tack o_ssi_lock_toggle",
                        title: "Lock / unlock column",
                        "data-lock-name": node.attrs.name,
                    })
                );
            }
            return $th;
        },

        /**
         * @param {String} name: Field name of the column
         * @returns {String}: Local storage key of the user's choice
         */
        _ssiLockKey: function (name) {
            return this.state.model + ":" + name;
        },

        /**
         * Column nodes carry the raw `options` string, not an evaluated object.
         *
         * @param {Object} node: Field node of the column
         * @returns {Object}
         */
        _ssiNodeOptions: function (node) {
            var options = node.attrs.options;
            if (typeof options === "string" && options) {
                try {
                    return pyUtils.py_eval(options) || {};
                } catch (e) {
                    return {};
                }
            }
            return options || {};
        },

        /**
         * User choice wins; otherwise the lock option of the field decides.
         *
         * @param {Object} node: Field node of the column
         * @returns {Boolean}
         */
        _ssiIsLocked: function (node) {
            var stored = readStoredLock(this._ssiLockKey(node.attrs.name));
            if (stored !== null) {
                return stored;
            }
            return Boolean(this._ssiNodeOptions(node).lock);
        },

        /**
         * @param {Element} table
         * @returns {Array}: True per header cell index, in header order
         */
        _ssiLockedHeaderCells: function (table) {
            var self = this;
            var lockedNames = {};
            this.columns.forEach(function (node) {
                if (node.tag === "field" && self._ssiIsLocked(node)) {
                    lockedNames[node.attrs.name] = true;
                }
            });
            var anyLocked = Object.keys(lockedNames).length > 0;
            var headers = table.querySelectorAll("thead tr:last-child th");
            return Array.prototype.map.call(headers, function (th) {
                if (th.classList.contains("o_list_record_selector")) {
                    return anyLocked;
                }
                return Boolean(lockedNames[th.dataset.name]);
            });
        },

        /**
         * Marks the cells of locked columns and sets their sticky offsets.
         */
        _ssiApplyLocks: function () {
            var table = this.el.querySelector("table.o_list_table");
            if (!table) {
                return;
            }
            var locked = this._ssiLockedHeaderCells(table);
            var headers = table.querySelectorAll("thead tr:last-child th");
            var offsets = [];
            var left = 0;
            var lastLocked = -1;
            locked.forEach(function (isLocked, index) {
                offsets[index] = left;
                if (isLocked) {
                    left += headers[index].offsetWidth;
                    lastLocked = index;
                }
            });
            table.querySelectorAll("tr").forEach(function (tr) {
                if (tr.classList.contains("o_group_header")) {
                    return;
                }
                var position = 0;
                Array.prototype.forEach.call(tr.cells, function (cell) {
                    var span = cell.colSpan || 1;
                    var isLocked = span === 1 && locked[position];
                    cell.classList.toggle("o_ssi_locked_col", Boolean(isLocked));
                    cell.classList.toggle(
                        "o_ssi_locked_col_last",
                        Boolean(isLocked) && position === lastLocked
                    );
                    cell.style.left = isLocked ? offsets[position] + "px" : "";
                    position += span;
                });
            });
            table.querySelectorAll(".o_ssi_lock_toggle").forEach(function (icon) {
                var th = icon.closest("th");
                icon.classList.toggle(
                    "o_ssi_lock_active",
                    th.classList.contains("o_ssi_locked_col")
                );
            });
        },

        /**
         * Offsets depend on rendered column widths, which change on resize.
         */
        _ssiObserveTable: function () {
            if (this._ssiResizeObserver) {
                this._ssiResizeObserver.disconnect();
            }
            var table = this.el.querySelector("table.o_list_table");
            if (!table || typeof window.ResizeObserver === "undefined") {
                return;
            }
            var self = this;
            this._ssiResizeObserver = new window.ResizeObserver(function () {
                self._ssiApplyLocks();
            });
            this._ssiResizeObserver.observe(table);
        },

        /**
         * Moves the optional columns toggler (three dots) out of the scrolling
         * box. Core puts it in the table, so it scrolls away with the content
         * and the scroll bar covers it. In a strip next to the scroll bar it
         * stays reachable in every browser.
         */
        _ssiMoveOptionalToggle: function () {
            var wrapper = this.el.querySelector(":scope > .table-responsive");
            var toggle = this.el.querySelector(
                "table .o_optional_columns_dropdown_toggle"
            );
            if (
                !wrapper ||
                !toggle ||
                !this.el.closest(".o_field_widget") ||
                window.getComputedStyle(wrapper).overflowY !== "auto"
            ) {
                return;
            }
            this.el.classList.add("o_ssi_toggle_strip");
            this.el.appendChild(toggle);
        },

        /**
         * @param {MouseEvent} ev
         */
        _onSsiLockToggle: function (ev) {
            var icon = ev.target.closest && ev.target.closest(".o_ssi_lock_toggle");
            if (!icon) {
                return;
            }
            // Keep the header click from also sorting the column.
            ev.stopPropagation();
            ev.preventDefault();
            var name = icon.dataset.lockName;
            var node = this.columns.find(function (col) {
                return col.tag === "field" && col.attrs.name === name;
            });
            if (node) {
                writeStoredLock(this._ssiLockKey(name), !this._ssiIsLocked(node));
                // The new order and the sticky offsets are applied by the
                // render, through _processColumns and _renderView.
                this._processColumns(this.columnInvisibleFields);
                this._render();
            }
        },

        /**
         * @param {MouseEvent} ev
         */
        _onSsiDragStart: function (ev) {
            if (ev.button !== 0 || ev.target.closest(IGNORE_SELECTOR)) {
                return;
            }
            // Horizontal only: vertical scrolling stays with the wheel/scroll bar.
            this._ssiDrag = {
                startX: ev.clientX,
                scrollX: getScrollParent(ev.target, "x"),
                moved: false,
            };
            if (!this._ssiDrag.scrollX) {
                this._ssiDrag = null;
                return;
            }
            // Without this the browser starts a text selection, then a native
            // drag-and-drop that swallows every following mouse event.
            ev.preventDefault();
            this._ssiDrag.originLeft = this._ssiDrag.scrollX.scrollLeft;
            document.addEventListener("mousemove", this._ssiOnMouseMove);
            document.addEventListener("mouseup", this._ssiOnMouseUp);
            // Browsers differ on whether preventing mousedown stops a text
            // selection, so also refuse the selection and native drag directly.
            document.addEventListener("selectstart", this._ssiBlockEvent, true);
            document.addEventListener("dragstart", this._ssiBlockEvent, true);
            document.body.classList.add("o_ssi_drag_armed");
            this._ssiClearSelection();
        },

        _ssiClearSelection: function () {
            var selection = window.getSelection();
            if (selection && selection.rangeCount) {
                selection.removeAllRanges();
            }
        },

        /**
         * @param {MouseEvent} ev
         */
        _onSsiDragMove: function (ev) {
            var drag = this._ssiDrag;
            if (!drag) {
                return;
            }
            var dx = ev.clientX - drag.startX;
            if (!drag.moved) {
                if (Math.abs(dx) < DRAG_THRESHOLD) {
                    return;
                }
                drag.moved = true;
                document.body.classList.add("o_ssi_dragging");
            }
            this._ssiClearSelection();
            drag.scrollX.scrollLeft = drag.originLeft - dx;
            ev.preventDefault();
        },

        _onSsiDragEnd: function () {
            var moved = this._ssiDrag && this._ssiDrag.moved;
            this._ssiStopDrag();
            if (moved) {
                // Swallow the click that follows the release so a drag does not
                // open a record or sort a column.
                var swallow = function (ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                };
                window.addEventListener("click", swallow, true);
                setTimeout(function () {
                    window.removeEventListener("click", swallow, true);
                }, 0);
            }
        },

        _ssiStopDrag: function () {
            document.removeEventListener("mousemove", this._ssiOnMouseMove);
            document.removeEventListener("mouseup", this._ssiOnMouseUp);
            document.removeEventListener("selectstart", this._ssiBlockEvent, true);
            document.removeEventListener("dragstart", this._ssiBlockEvent, true);
            document.body.classList.remove("o_ssi_drag_armed");
            document.body.classList.remove("o_ssi_dragging");
            this._ssiDrag = null;
        },
    });
});
