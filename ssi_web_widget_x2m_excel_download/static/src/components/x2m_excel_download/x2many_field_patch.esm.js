/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {X2ManyField} from "@web/views/fields/x2many/x2many_field";
import {_t} from "@web/core/l10n/translation";
import {downloadXlsx} from "./xlsx_writer.esm";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";
import {useState} from "@odoo/owl";

const RELATIONAL_FIELD_TYPES = ["one2many", "many2many"];
const BATCH_SIZE = 500;

/**
 * Adds an "Excel Download" button to the control panel
 * (`o_x2m_control_panel`) of every one2many/many2many list rendered inside
 * a form, exporting **all** linked records (not just the current page).
 *
 * Ported from the 14.0 module of the same name, which used
 * `FieldOne2Many.include({})`/`FieldMany2Many.include({})`
 * (`web.relational_fields`). Both field types are rendered by a single
 * `X2ManyField` component in Odoo 19
 * (`@web/views/fields/x2many/x2many_field`, template `web.X2ManyField`) —
 * `.include()` has no equivalent, so the button is added by patching that
 * component's prototype and extending its template instead. No new field
 * widget is registered (see `x2many_field_patch.xml`), so the button keeps
 * appearing automatically on every x2many list, exactly as in 14.0.
 *
 * The `excel_download` arch option from 14.0
 * (`options="{'excel_download': 0}"`) is preserved: it now arrives as
 * `this.props.crudOptions.excel_download`, the generic `options="{...}"`
 * dict every field node exposes to `extractProps`.
 */
patch(X2ManyField.prototype, {
    setup() {
        super.setup();
        this.excelDownloadOrm = useService("orm");
        this.excelDownloadState = useState({busy: false, status: ""});
    },

    /**
     * @returns {Boolean} false when the field node has
     *   `options="{'excel_download': 0}"`.
     */
    get excelDownloadOptionEnabled() {
        const excelDownload = (this.props.crudOptions || {}).excel_download;
        return !(excelDownload === 0 || excelDownload === "0");
    },

    /**
     * Visible, non-relational columns of the current list arch, mirroring
     * the 14.0 `getVisibleCols` helper.
     *
     * @returns {Array<Object>}
     */
    get excelDownloadColumns() {
        const columns = (this.archInfo && this.archInfo.columns) || [];
        return columns.filter(
            (column) =>
                column.type === "field" &&
                !RELATIONAL_FIELD_TYPES.includes(column.fieldType) &&
                !(
                    column.column_invisible &&
                    this.evalInvisible(column.column_invisible)
                )
        );
    },

    /**
     * @returns {Boolean} whether the download button should be shown.
     */
    get excelDownloadVisible() {
        return (
            this.props.viewMode === "list" &&
            this.excelDownloadOptionEnabled &&
            this.excelDownloadColumns.length > 0
        );
    },

    /**
     * @returns {Boolean}
     */
    get excelDownloadBusy() {
        return this.excelDownloadState.busy;
    },

    /**
     * @returns {String}
     */
    get excelDownloadStatus() {
        return this.excelDownloadState.status;
    },

    /**
     * Formats a single cell for the exported sheet. Accepts both the
     * server (`orm.read`) shape for many2one (`[id, display_name]`) and
     * the client relational-model shape (`{id, display_name}`), since rows
     * can come from either source (see `excelDownloadFetchRows`).
     *
     * @param {*} value
     * @param {Object} field
     * @returns {String}
     */
    excelDownloadFormatCell(value, field) {
        if (value === undefined || value === null || value === false) {
            return "";
        }
        const type = field ? field.type : null;
        if (type === "many2one") {
            if (Array.isArray(value)) {
                return value.length > 1 ? String(value[1]) : "";
            }
            if (typeof value === "object") {
                return value.display_name ? String(value.display_name) : "";
            }
            return String(value);
        }
        if (type === "selection" && field.selection) {
            const match = field.selection.find((item) => item[0] === value);
            return match ? String(match[1]) : String(value);
        }
        if (type === "boolean") {
            return value ? _t("Yes") : _t("No");
        }
        if (Array.isArray(value)) {
            return value.join(", ");
        }
        return String(value);
    },

    /**
     * Fetches every linked record (all pages, not only the one currently
     * rendered) and returns a 2-D array ready for `downloadXlsx`: header
     * row followed by one row per record, in `list.currentIds` order.
     *
     * Saved records are read in batches through the ORM service
     * (`this.excelDownloadOrm`, `@web/core/orm_service` — not
     * `web.rpc`/`session`, which do not exist in Odoo 19). Records that
     * only exist locally (new/unsaved lines, `_virtualId`) are read from
     * `this.list.records`, which always holds them regardless of
     * pagination.
     *
     * @param {Array<Object>} columns
     * @returns {Promise<Array<Array>>}
     */
    async excelDownloadFetchRows(columns) {
        const list = this.list;
        const fieldNames = columns.map((column) => column.name);
        const currentIds = list.currentIds;
        const realIds = currentIds.filter((id) => typeof id === "number");

        const dataById = {};
        for (let i = 0; i < realIds.length; i += BATCH_SIZE) {
            const batchIds = realIds.slice(i, i + BATCH_SIZE);
            const records = await this.excelDownloadOrm.read(
                list.resModel,
                batchIds,
                fieldNames
            );
            for (const record of records) {
                dataById[record.id] = record;
            }
        }

        const rows = [columns.map((column) => column.label || column.name)];
        for (const id of currentIds) {
            let data = null;
            if (typeof id === "number") {
                data = dataById[id];
            } else {
                const record = list.records.find((r) => r._virtualId === id);
                data = record ? record.data : null;
            }
            if (!data) {
                continue;
            }
            rows.push(
                columns.map((column) =>
                    this.excelDownloadFormatCell(
                        data[column.name],
                        this.props.relatedFields[column.name]
                    )
                )
            );
        }
        return rows;
    },

    /**
     * @returns {String} export filename, without extension.
     */
    get excelDownloadFilename() {
        const label = this.field.string || this.props.name;
        const recordName = this.props.record.data.display_name;
        return recordName ? `${recordName} - ${label}` : label;
    },

    /**
     * Click handler for the download button: fetches every linked record
     * and triggers the `.xlsx` download, showing a short status message
     * while it runs.
     */
    async onExcelDownloadClick() {
        if (this.excelDownloadState.busy) {
            return;
        }
        const columns = this.excelDownloadColumns;
        if (!columns.length) {
            return;
        }
        this.excelDownloadState.busy = true;
        this.excelDownloadState.status = _t("Preparing export…");
        try {
            const rows = await this.excelDownloadFetchRows(columns);
            if (rows.length <= 1) {
                this.excelDownloadState.status = _t("No records to export.");
                return;
            }
            downloadXlsx(rows, this.excelDownloadFilename);
            this.excelDownloadState.status = "";
        } catch (error) {
            console.error("[x2m_excel_download] Export failed:", error);
            this.excelDownloadState.status = _t(
                "Export failed. See the browser console for details."
            );
        } finally {
            this.excelDownloadState.busy = false;
        }
    },
});
