/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component, useEffect, useRef, useState} from "@odoo/owl";
import {parseCSV, rowsToCSV} from "./csv_table_parser.esm";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {standardFieldProps} from "@web/views/fields/standard_field_props";

const PAGE_SIZE = 50;

/**
 * CSV Table field widget.
 *
 * Read-only mode : renders the CSV content of a `Text` field as a
 *                  paginated HTML table — the first row is the header.
 * Edit mode      : two buttons toggle between a raw CSV textarea and a
 *                  table view whose cells can be edited directly; both
 *                  views write the same CSV string back to the field.
 *
 * Usage in XML view:
 *   <field name="my_text_field" widget="csv_table"/>
 */
export class CsvTableField extends Component {
    static template = "ssi_web_widget_csv_table.CsvTableField";
    static props = {
        ...standardFieldProps,
    };

    setup() {
        this.textareaRef = useRef("textarea");
        this.state = useState({mode: "text", page: 0});

        // The raw CSV textarea is intentionally left uncontrolled: its
        // value is set once via this effect (on mount, and whenever we
        // switch back into text mode or the field's readonly status
        // flips) instead of a reactive `t-att-value`, so live typing is
        // never overwritten by a re-render triggered elsewhere in the
        // form.
        useEffect(
            () => {
                if (
                    !this.props.readonly &&
                    this.state.mode === "text" &&
                    this.textareaRef.el
                ) {
                    this.textareaRef.el.value = this.value;
                }
            },
            () => [this.props.readonly, this.state.mode]
        );
    }

    // ------------------------------------------------------------------
    // Getters
    // ------------------------------------------------------------------

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    /** @returns {string[][]} full parsed CSV — header row included. */
    get rows() {
        return parseCSV(this.value);
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get headerCells() {
        return this.hasRows ? this.rows[0] : [];
    }

    get dataRows() {
        return this.hasRows ? this.rows.slice(1) : [];
    }

    get columnCount() {
        return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
    }

    /** @returns {number[]} `[0, 1, ..., columnCount - 1]`. */
    get columnIndexes() {
        return Array.from({length: this.columnCount}, (_ignored, index) => index);
    }

    get pageCount() {
        return Math.max(1, Math.ceil(this.dataRows.length / PAGE_SIZE));
    }

    get currentPage() {
        return Math.min(this.state.page, this.pageCount - 1);
    }

    /** @returns {string[][]} data rows (header excluded) for the current page. */
    get pageRows() {
        const start = this.currentPage * PAGE_SIZE;
        return this.dataRows.slice(start, start + PAGE_SIZE);
    }

    get pageInfo() {
        const total = this.dataRows.length;
        if (!total) {
            return _t("0 rows, %s columns", this.columnCount);
        }
        const start = this.currentPage * PAGE_SIZE + 1;
        const end = Math.min(start + PAGE_SIZE - 1, total);
        return _t("%(start)s–%(end)s of %(total)s rows, %(cols)s columns", {
            start,
            end,
            total,
            cols: this.columnCount,
        });
    }

    // ------------------------------------------------------------------
    // Cell helpers
    // ------------------------------------------------------------------

    headerCell(columnIndex) {
        const cell = this.headerCells[columnIndex];
        return cell ? cell.trim() : "";
    }

    cellValue(row, columnIndex) {
        const cell = columnIndex < row.length ? row[columnIndex] : "";
        return cell || "";
    }

    rowNumber(rowIndexInPage) {
        return this.currentPage * PAGE_SIZE + rowIndexInPage + 1;
    }

    isNumeric(cellText) {
        const trimmed = (cellText || "").trim();
        return trimmed !== "" && !isNaN(trimmed.replace(/,/g, ""));
    }

    isBoolean(cellText) {
        const upper = (cellText || "").trim().toUpperCase();
        return upper === "TRUE" || upper === "FALSE";
    }

    isChecked(cellText) {
        return (cellText || "").trim().toUpperCase() === "TRUE";
    }

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------

    /** @param {"text"|"table"} mode */
    setMode(mode) {
        if (mode === this.state.mode) {
            return;
        }
        if (mode === "table" && this.textareaRef.el) {
            // Commit whatever was last typed in the textarea before
            // switching, so the table reflects the latest text edits.
            this.commitCsv(this.textareaRef.el.value);
        }
        this.state.mode = mode;
        this.state.page = 0;
    }

    goToPage(page) {
        this.state.page = Math.max(0, Math.min(page, this.pageCount - 1));
    }

    onTextareaInput(ev) {
        this.commitCsv(ev.target.value);
    }

    /**
     * @param {Number} rowIndexInPage - index within the current page's
     *   data rows (0-based).
     * @param {Number} columnIndex
     * @param {String} rawValue
     */
    onCellChange(rowIndexInPage, columnIndex, rawValue) {
        const rows = this.rows;
        const absoluteRow = 1 + this.currentPage * PAGE_SIZE + rowIndexInPage;
        while (rows.length <= absoluteRow) {
            rows.push([]);
        }
        while (rows[absoluteRow].length <= columnIndex) {
            rows[absoluteRow].push("");
        }
        rows[absoluteRow][columnIndex] = rawValue;
        this.commitCsv(rowsToCSV(rows));
    }

    onCellInputChange(rowIndexInPage, columnIndex, ev) {
        this.onCellChange(rowIndexInPage, columnIndex, ev.target.value);
    }

    onCellCheckboxChange(rowIndexInPage, columnIndex, ev) {
        this.onCellChange(
            rowIndexInPage,
            columnIndex,
            ev.target.checked ? "TRUE" : "FALSE"
        );
    }

    commitCsv(csv) {
        this.props.record.update({[this.props.name]: csv});
    }
}

export const csvTableField = {
    component: CsvTableField,
    displayName: _t("CSV Table"),
    supportedTypes: ["text"],
};

registry.category("fields").add("csv_table", csvTableField);
