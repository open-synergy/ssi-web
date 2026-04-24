// Copyright 2025 OpenSynergy Indonesia
// Copyright 2025 PT. Simetri Sinergi Indonesia
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

odoo.define("ssi_web_widget_json.JsonViewerWidget", function (require) {
    "use strict";

    var AbstractField = require("web.AbstractField");
    var fieldRegistry = require("web.field_registry");
    var core = require("web.core");

    var _t = core._t;

    /**
     * JSON Viewer Widget
     *
     * Read-only mode : renders JSON as an interactive, syntax-highlighted,
     *                  expandable/collapsible tree.
     * Edit mode      : renders a monospace textarea with real-time
     *                  valid/invalid JSON feedback.
     *
     * Usage in XML view:
     *   <field name="my_text_field" widget="json_viewer"/>
     */
    var JsonViewerWidget = AbstractField.extend({
        className: "o_field_json_viewer",
        supportedFieldTypes: ["text", "char"],
        tagName: "div",

        events: _.extend({}, AbstractField.prototype.events, {
            "click .o_json_toggle": "_onToggleNode",
            "input .o_json_editor": "_onEditorInput",
            "keydown .o_json_editor": "_onEditorKeydown",
        }),

        // ------------------------------------------------------------------
        // Rendering
        // ------------------------------------------------------------------

        /**
         * @override
         */
        _renderEdit: function () {
            var value = this.value || "";
            var displayValue = value;
            if (value) {
                try {
                    displayValue = JSON.stringify(JSON.parse(value), null, 2);
                } catch (e) {
                    // Keep raw value as-is
                }
            }

            var $wrapper = $("<div>", {class: "o_json_editor_wrapper"});
            this.$textarea = $("<textarea>", {
                class: "o_json_editor o_input",
                rows: 10,
                spellcheck: false,
            }).val(displayValue);
            this.$status = $("<div>", {class: "o_json_status"});

            $wrapper.append(this.$textarea).append(this.$status);
            this.$el.empty().append($wrapper);
            this._updateValidationStatus(displayValue);
        },

        /**
         * @override
         */
        _renderReadonly: function () {
            var value = this.value || "";
            this.$el.empty();

            if (!value) {
                this.$el.append(
                    $("<span>", {class: "o_json_empty"}).text(_t("(empty)"))
                );
                return;
            }

            try {
                var data = JSON.parse(value);
                var $container = $("<div>", {class: "o_json_viewer_container"});
                $container.append(this._buildTree(data, 0));
                this.$el.append($container);
            } catch (e) {
                // Not valid JSON — show raw text gracefully
                this.$el.append($("<pre>", {class: "o_json_raw_text"}).text(value));
            }
        },

        // ------------------------------------------------------------------
        // Value management
        // ------------------------------------------------------------------

        /**
         * Ensure the textarea value is committed before the record saves.
         * @override
         */
        commitChanges: function () {
            if (this.mode === "edit" && this.$textarea) {
                return this._setValue(this.$textarea.val());
            }
        },

        // ------------------------------------------------------------------
        // Event handlers
        // ------------------------------------------------------------------

        /**
         * Update validation badge and propagate value on each keystroke.
         * @private
         */
        _onEditorInput: function () {
            if (!this.$textarea || !this.$status) {
                return;
            }
            var val = this.$textarea.val();
            this._updateValidationStatus(val);
            this._setValue(val);
        },

        /**
         * Insert 4 spaces on Tab instead of moving browser focus.
         * @private
         */
        _onEditorKeydown: function (e) {
            if (e.keyCode === 9) {
                e.preventDefault();
                var el = e.target;
                var start = el.selectionStart;
                var end = el.selectionEnd;
                var indent = "    ";
                el.value =
                    el.value.substring(0, start) + indent + el.value.substring(end);
                el.selectionStart = el.selectionEnd = start + indent.length;
            }
        },

        /**
         * Toggle expand / collapse for an object or array node.
         * @private
         */
        _onToggleNode: function (e) {
            var $toggle = $(e.currentTarget);
            var $children = $toggle
                .closest(".o_json_node")
                .find("> .o_json_children")
                .first();
            if ($children.is(":visible")) {
                $children.slideUp(100);
                $toggle
                    .removeClass("fa-caret-down")
                    .addClass("fa-caret-right")
                    .attr("title", _t("Expand"));
            } else {
                $children.slideDown(100);
                $toggle
                    .removeClass("fa-caret-right")
                    .addClass("fa-caret-down")
                    .attr("title", _t("Collapse"));
            }
        },

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        /**
         * Show a ✓ / ✗ badge indicating whether `val` is valid JSON.
         * @param {String} val
         * @private
         */
        _updateValidationStatus: function (val) {
            if (!this.$status) {
                return;
            }
            if (!val) {
                this.$status.text("").removeClass("o_json_valid o_json_invalid");
                return;
            }
            try {
                JSON.parse(val);
                this.$status
                    .text(_t("✓ Valid JSON"))
                    .removeClass("o_json_invalid")
                    .addClass("o_json_valid");
            } catch (e) {
                this.$status
                    .text(_t("✗ Invalid JSON") + ": " + e.message)
                    .removeClass("o_json_valid")
                    .addClass("o_json_invalid");
            }
        },

        /**
         * Recursively build a jQuery DOM tree representing `data`.
         *
         * @param {*}      data  — any JSON-compatible value
         * @param {Number} depth — current nesting level (0 = root)
         * @returns {jQuery}
         * @private
         */
        _buildTree: function (data, depth) {
            var self = this;

            // --- Scalar / null values ---
            if (data === null) {
                return $("<span>", {class: "o_json_value_null"}).text("null");
            }
            if (typeof data === "boolean") {
                return $("<span>", {class: "o_json_value_boolean"}).text(String(data));
            }
            if (typeof data === "number") {
                return $("<span>", {class: "o_json_value_number"}).text(String(data));
            }
            if (typeof data === "string") {
                return $("<span>", {class: "o_json_value_string"}).text(
                    '"' + data + '"'
                );
            }

            // --- Object / Array ---
            var isArray = Array.isArray(data);
            var keys = Object.keys(data);

            if (keys.length === 0) {
                return $("<span>", {class: "o_json_empty_obj"}).text(
                    isArray ? "[]" : "{}"
                );
            }

            var $ul = $("<ul>", {
                class: "o_json_list" + (depth === 0 ? " o_json_root" : ""),
            });

            keys.forEach(function (key) {
                var val = data[key];
                var $li = $("<li>", {class: "o_json_node"});
                var $keySpan = $("<span>", {class: "o_json_key"}).text(
                    isArray ? "[" + key + "]" : key
                );
                var $colon = $("<span>", {class: "o_json_colon"}).text(": ");
                var isComplex = val !== null && typeof val === "object";

                if (isComplex) {
                    var childIsArray = Array.isArray(val);
                    var childCount = Object.keys(val).length;
                    var summary = childIsArray
                        ? "[" +
                          childCount +
                          " item" +
                          (childCount !== 1 ? "s" : "") +
                          "]"
                        : "{" +
                          childCount +
                          " key" +
                          (childCount !== 1 ? "s" : "") +
                          "}";

                    var $toggle = $("<span>", {
                        class: "o_json_toggle fa fa-caret-down",
                        title: _t("Collapse"),
                    });
                    var $summary = $("<span>", {
                        class: "o_json_summary",
                    }).text(summary);
                    var $children = $("<div>", {class: "o_json_children"});
                    $children.append(self._buildTree(val, depth + 1));

                    $li.append($toggle)
                        .append($keySpan)
                        .append($colon)
                        .append($summary)
                        .append($children);
                } else {
                    $li.append($keySpan)
                        .append($colon)
                        .append(self._buildTree(val, depth + 1));
                }

                $ul.append($li);
            });

            return $ul;
        },
    });

    fieldRegistry.add("json_viewer", JsonViewerWidget);

    return JsonViewerWidget;
});
