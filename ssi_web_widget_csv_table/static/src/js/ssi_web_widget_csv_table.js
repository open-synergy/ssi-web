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

    var FieldCsvTable = basic_fields.FieldText.extend({
        className: "o_field_csv_table",
        supportedFieldTypes: ["text"],

        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this._hasHeader = true;
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

            var $wrapper = $("<div/>", {
                class: "csv_table_wrapper",
            });

            var $table = $("<table/>", {
                class: "csv_table table table-sm table-bordered table-hover",
            });

            // Determine max columns for uniform width
            var maxCols = 0;
            for (var r = 0; r < rows.length; r++) {
                if (rows[r].length > maxCols) {
                    maxCols = rows[r].length;
                }
            }

            // Render header (first row)
            if (this._hasHeader && rows.length > 0) {
                var $thead = $("<thead/>");
                var $headerRow = $("<tr/>");
                // Row number header
                $headerRow.append(
                    $("<th/>", {
                        class: "csv_table_row_number",
                        text: "#",
                    })
                );
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

            // Render body
            var $tbody = $("<tbody/>");
            var startRow = this._hasHeader ? 1 : 0;
            for (var i = startRow; i < rows.length; i++) {
                var $tr = $("<tr/>");
                // Row number
                $tr.append(
                    $("<td/>", {
                        class: "csv_table_row_number",
                        text: this._hasHeader ? i : i + 1,
                    })
                );
                for (var j = 0; j < maxCols; j++) {
                    var cellValue = j < rows[i].length ? rows[i][j].trim() : "";
                    var $td = $("<td/>");
                    // Right-align if numeric
                    if (cellValue !== "" && !isNaN(cellValue.replace(/,/g, ""))) {
                        $td.addClass("csv_table_cell_numeric");
                    }
                    $td.text(cellValue);
                    $tr.append($td);
                }
                $tbody.append($tr);
            }
            $table.append($tbody);

            // Row count info
            var dataRowCount = rows.length - (this._hasHeader ? 1 : 0);
            var $info = $("<div/>", {
                class: "csv_table_info text-muted small mt-1",
                text: dataRowCount + " rows, " + maxCols + " columns",
            });

            $wrapper.append($table);
            $wrapper.append($info);

            this.$el.empty().append($wrapper);
        },
    });

    field_registry.add("csv_table", FieldCsvTable);

    return {
        FieldCsvTable: FieldCsvTable,
        parseCSV: parseCSV,
    };
});
