odoo.define("ssi_web_widget_csv_table.csv_table", function (require) {
    "use strict";

    var basic_fields = require("web.basic_fields");
    var field_registry = require("web.field_registry");

    /**
     * Parse a CSV string into a 2D array, handling quoted fields.
     *
     * @param {String} text - CSV text
     * @returns {Array<Array<String>>} - 2D array of cell values
     */
    function parseCSV(text) {
        var rows = [];
        var row = [];
        var cell = "";
        var inQuotes = false;
        var i = 0;
        var len = text.length;

        while (i < len) {
            var ch = text[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < len && text[i + 1] === '"') {
                        // Escaped quote
                        cell += '"';
                        i += 2;
                    } else {
                        // End of quoted field
                        inQuotes = false;
                        i++;
                    }
                } else {
                    cell += ch;
                    i++;
                }
            } else if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ",") {
                row.push(cell);
                cell = "";
                i++;
            } else if (ch === "\r") {
                row.push(cell);
                cell = "";
                rows.push(row);
                row = [];
                i++;
                if (i < len && text[i] === "\n") {
                    i++;
                }
            } else if (ch === "\n") {
                row.push(cell);
                cell = "";
                rows.push(row);
                row = [];
                i++;
            } else {
                cell += ch;
                i++;
            }
        }

        // Push last cell and row
        if (cell !== "" || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        return rows;
    }

    /**
     * Convert a 2D array back to CSV string.
     *
     * @param {Array<Array<String>>} rows - 2D array of cell values
     * @returns {String} - CSV text
     */
    function rowsToCSV(rows) {
        var lines = [];
        for (var i = 0; i < rows.length; i++) {
            var csvRow = [];
            for (var j = 0; j < rows[i].length; j++) {
                var cell = rows[i][j] || "";
                if (
                    cell.indexOf(",") !== -1 ||
                    cell.indexOf('"') !== -1 ||
                    cell.indexOf("\n") !== -1 ||
                    cell.indexOf("\r") !== -1
                ) {
                    cell = '"' + cell.replace(/"/g, '""') + '"';
                }
                csvRow.push(cell);
            }
            lines.push(csvRow.join(","));
        }
        return lines.join("\n");
    }

    /**
     * Build an editable cell (checkbox or text input) and append to $td.
     *
     * @param {jQuery} $td - table cell element
     * @param {String} cellValue - raw cell value
     * @param {String} trimmed - trimmed cell value
     * @param {Number} rowIdx - row index for data attribute
     * @param {Number} colIdx - column index for data attribute
     * @returns {void}
     */
    function _buildEditableCell($td, cellValue, trimmed, rowIdx, colIdx) {
        $td.addClass("csv_table_edit_cell p-0");
        var upperVal = trimmed.toUpperCase();
        if (upperVal === "TRUE" || upperVal === "FALSE") {
            var $cb = $("<input/>", {
                type: "checkbox",
                class: "csv_table_cell_checkbox",
                "data-row": rowIdx,
                "data-col": colIdx,
            });
            if (upperVal === "TRUE") {
                $cb.prop("checked", true);
            }
            $td.addClass("text-center align-middle").append($cb);
        } else {
            var $inp = $("<input/>", {
                type: "text",
                class:
                    "csv_table_cell_input form-control form-control-sm border-0 rounded-0",
                value: cellValue,
                "data-row": rowIdx,
                "data-col": colIdx,
            });
            if (trimmed !== "" && !isNaN(trimmed.replace(/,/g, ""))) {
                $inp.addClass("text-right");
            }
            $td.append($inp);
        }
    }

    /**
     * Build a single tbody row for the table.
     *
     * @param {Array<Array<String>>} rows - all data rows
     * @param {Number} i - current row index
     * @param {Boolean} hasHeader - whether first row is header
     * @param {Number} maxCols - total number of columns
     * @param {Boolean} editable - render editable inputs
     * @returns {jQuery} <tr> element
     */
    function _buildBodyRow(rows, i, hasHeader, maxCols, editable) {
        var $tr = $("<tr/>");
        $tr.append(
            $("<td/>", {
                class: "csv_table_row_number",
                text: hasHeader ? i : i + 1,
            })
        );
        for (var j = 0; j < maxCols; j++) {
            var cellValue = j < rows[i].length ? rows[i][j] : "";
            var trimmed = cellValue.trim();
            var $td = $("<td/>");
            if (editable) {
                _buildEditableCell($td, cellValue, trimmed, i, j);
            } else {
                if (trimmed !== "" && !isNaN(trimmed.replace(/,/g, ""))) {
                    $td.addClass("csv_table_cell_numeric");
                }
                $td.text(trimmed);
            }
            $tr.append($td);
        }
        return $tr;
    }

    /**
     * Build an HTML table from parsed CSV rows.
     *
     * @param {Array<Array<String>>} rows - 2D array of cell values
     * @param {Boolean} hasHeader - treat first row as header
     * @param {Object} [opts] - optional settings
     * @param {Boolean} [opts.editable] - render editable inputs
     * @returns {jQuery} $wrapper element
     */
    function buildTable(rows, hasHeader, opts) {
        var options = opts || {};
        var editable = options.editable || false;

        var maxCols = 0;
        for (var r = 0; r < rows.length; r++) {
            if (rows[r].length > maxCols) {
                maxCols = rows[r].length;
            }
        }

        var $wrapper = $("<div/>", {
            class: "csv_table_wrapper",
        });

        var $table = $("<table/>", {
            class: "csv_table table table-sm table-bordered table-hover",
        });

        // Header (first row)
        if (hasHeader && rows.length > 0) {
            var $thead = $("<thead/>");
            var $headerRow = $("<tr/>");
            $headerRow.append($("<th/>", {class: "csv_table_row_number", text: "#"}));
            var headerCells = rows[0];
            for (var h = 0; h < maxCols; h++) {
                $headerRow.append(
                    $("<th/>", {
                        text: h < headerCells.length ? headerCells[h].trim() : "",
                    })
                );
            }
            $thead.append($headerRow);
            $table.append($thead);
        }

        // Body
        var $tbody = $("<tbody/>");
        var startRow = hasHeader ? 1 : 0;
        for (var i = startRow; i < rows.length; i++) {
            $tbody.append(_buildBodyRow(rows, i, hasHeader, maxCols, editable));
        }
        $table.append($tbody);

        // Row count info
        var dataRowCount = rows.length - (hasHeader ? 1 : 0);
        var $info = $("<div/>", {
            class: "csv_table_info text-muted small mt-1",
            text: dataRowCount + " rows, " + maxCols + " columns",
        });

        $wrapper.append($table);
        $wrapper.append($info);

        return $wrapper;
    }

    var FieldCsvTable = basic_fields.FieldText.extend({
        className: "o_field_csv_table",
        supportedFieldTypes: ["text"],

        events: _.extend({}, basic_fields.FieldText.prototype.events, {
            "click .csv_table_toggle_btn": "_onToggleMode",
            "change .csv_table_cell_input": "_onTableCellChange",
            "change .csv_table_cell_checkbox": "_onTableCellChange",
        }),

        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this._hasHeader = true;
            this._tableEditMode = false;
            // FieldText sets tagName='textarea' in edit mode, making $el the
            // textarea itself.  We need a wrapper div so we can place toggle
            // buttons alongside the textarea.
            if (this.mode === "edit") {
                this.tagName = "div";
            }
        },

        /**
         * @override
         * FieldText.start() calls dom.autoresize(this.$el) which sets inline
         * height + overflow:hidden on $el (our wrapper div).  Let parent run
         * normally, then undo the inline styles.
         */
        start: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                if (self.mode === "edit") {
                    self.$el.css({
                        height: "",
                        "overflow-y": "",
                        resize: "",
                    });
                }
            });
        },

        // ------------------------------------------------------------
        // Private
        // ------------------------------------------------------------

        /**
         * @override
         */
        _renderReadonly: function () {
            var value = this.value;
            if (!value) {
                this.$el.empty();
                return;
            }

            var rows = parseCSV(value);
            if (!rows.length) {
                this.$el.empty();
                return;
            }

            this.$el
                .empty()
                .append(buildTable(rows, this._hasHeader, {editable: false}));
        },

        /**
         * @override
         * FieldText normally IS a <textarea> (tagName='textarea').  We changed
         * tagName to 'div' so we can place toggle buttons next to the textarea.
         * Therefore we create the textarea ourselves and register it via
         * _prepareInput.
         */
        _renderEdit: function () {
            this.$el.empty();

            // 1. Toggle bar
            var $bar = $("<div/>", {class: "csv_table_toggle_bar d-flex mb-2"});
            $bar.append(
                $("<button/>", {
                    class:
                        "btn btn-sm mr-1 csv_table_toggle_btn" +
                        (this._tableEditMode
                            ? " btn-outline-secondary"
                            : " btn-primary"),
                    "data-mode": "text",
                    text: "Text",
                    type: "button",
                })
            );
            $bar.append(
                $("<button/>", {
                    class:
                        "btn btn-sm csv_table_toggle_btn" +
                        (this._tableEditMode
                            ? " btn-primary"
                            : " btn-outline-secondary"),
                    "data-mode": "table",
                    text: "Table",
                    type: "button",
                })
            );
            this.$el.append($bar);

            // 2. Create textarea manually and register via _prepareInput
            var lineCount = (this.value || "").split("\n").length;
            var rows = Math.max(10, Math.min(lineCount + 2, 30));
            var $textarea = $("<textarea/>", {
                rows: rows,
                class: "csv_table_textarea",
            });
            this._prepareInput($textarea);
            this.$el.append(this.$input);

            // 3. In table mode, hide the textarea and render editable table
            if (this._tableEditMode) {
                this.$input.css("display", "none");
                this._appendEditableTable();
            }
        },

        /**
         * Append an editable HTML table below the toggle bar.
         * The hidden $input textarea keeps the value for the framework.
         */
        _appendEditableTable: function () {
            var value = this.value || "";
            if (!value) {
                this.$el.append(
                    $("<p/>", {
                        class: "csv_table_empty_msg text-muted",
                        text: "No data. Switch to Text mode to enter CSV data.",
                    })
                );
                return;
            }

            var rows = parseCSV(value);
            if (!rows.length) {
                this.$el.append(
                    $("<p/>", {
                        class: "csv_table_empty_msg text-muted",
                        text: "No data.",
                    })
                );
                return;
            }

            this.$el.append(buildTable(rows, this._hasHeader, {editable: true}));
        },

        // ------------------------------------------------------------
        // Handlers
        // ------------------------------------------------------------

        /**
         * Handle text/table toggle clicks.
         *
         * @param {Event} ev - click event
         * @returns {void}
         */
        _onToggleMode: function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var mode = $(ev.currentTarget).data("mode");
            var isTable = mode === "table";
            if (isTable === this._tableEditMode) {
                return;
            }

            // Sync value from current mode before switching
            if (this._tableEditMode) {
                // TABLE -> TEXT: collect table edits into textarea
                this.$input.val(this._collectTableValue());
            }

            this._tableEditMode = isTable;

            // Update toggle button styles
            this.$el.find(".csv_table_toggle_btn").each(function () {
                var $btn = $(this);
                if ($btn.data("mode") === mode) {
                    $btn.removeClass("btn-outline-secondary").addClass("btn-primary");
                } else {
                    $btn.removeClass("btn-primary").addClass("btn-outline-secondary");
                }
            });

            // Remove old table / empty message
            this.$el.find(".csv_table_wrapper").remove();
            this.$el.find(".csv_table_empty_msg").remove();

            if (isTable) {
                // TEXT -> TABLE
                // Re-parse value from textarea (user may have edited it)
                this.value = this.$input.val();
                this.$input.css("display", "none");
                this._appendEditableTable();
            } else {
                // TABLE -> TEXT
                this.$input.css("display", "");
            }
        },

        /**
         * Handle cell changes in table-edit mode — sync to hidden textarea.
         */
        _onTableCellChange: function () {
            var csv = this._collectTableValue();
            this.$input.val(csv);
            this._setValue(csv);
        },

        // ------------------------------------------------------------
        // Value collection helpers
        // ------------------------------------------------------------

        /**
         * Reconstruct CSV text from the editable table cells.
         *
         * @returns {String} CSV text
         */
        _collectTableValue: function () {
            var value = this.value || "";
            var rows = parseCSV(value);
            if (!rows.length) {
                return value;
            }

            this.$el.find("[data-row][data-col]").each(function () {
                var $el = $(this);
                var r = parseInt($el.data("row"), 10);
                var c = parseInt($el.data("col"), 10);
                var val = $el.is(":checkbox")
                    ? $el.prop("checked")
                        ? "TRUE"
                        : "FALSE"
                    : $el.val();
                while (rows.length <= r) {
                    rows.push([]);
                }
                while (rows[r].length <= c) {
                    rows[r].push("");
                }
                rows[r][c] = val;
            });

            return rowsToCSV(rows);
        },

        // ------------------------------------------------------------
        // Overrides
        // ------------------------------------------------------------

        /**
         * @override
         * Ensure the current edit value is committed before the form saves.
         */
        commitChanges: function () {
            if (this.mode === "edit" && this._tableEditMode) {
                var csv = this._collectTableValue();
                this.$input.val(csv);
                return this._setValue(csv);
            }
            return this._super.apply(this, arguments);
        },
    });

    field_registry.add("csv_table", FieldCsvTable);

    return {
        FieldCsvTable: FieldCsvTable,
        parseCSV: parseCSV,
    };
});
