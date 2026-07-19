/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {X2ManyField, x2ManyField} from "@web/views/fields/x2many/x2many_field";
import {onRendered, useRef, useState} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";

const formatters = registry.category("formatters");

/**
 * `X2ManyField` subclass that adds a search box to the control panel of a
 * one2many/many2many list, filtering the rows already loaded by the
 * relational model (`StaticList`) for the current page.
 *
 * Server-side search is not possible in Odoo 19: `StaticList.load()`
 * (`@web/model/relational_model/static_list`) does not accept a `domain`
 * parameter, unlike the 14.0 `web.rpc` search this module used to perform.
 * Accepting that limit, filtering here stays entirely in the view layer:
 * a matching row keeps its place in `list.records`/`list._commands`, only
 * its already-rendered `<tr class="o_data_row">` gets a CSS class toggled
 * on the DOM. `StaticList` itself is never read from except to compute
 * matches, and never written to — hiding a row must never look like
 * deleting it to the save logic.
 */
export class X2mSearchField extends X2ManyField {
    static template = "ssi_web_x2m_search.X2mSearchField";

    setup() {
        super.setup();
        this.x2mSearchState = useState({value: ""});
        this.x2mSearchRootRef = useRef("x2mSearchRoot");
        onRendered(() => this.applyX2mSearchFilter());
    }

    get x2mSearchPlaceholder() {
        return _t("Search…");
    }

    /**
     * @returns {Boolean} the search box only makes sense for the list
     *   sub-view; kanban x2many keeps its default layout untouched.
     */
    get x2mSearchBoxVisible() {
        return this.props.viewMode === "list";
    }

    /**
     * Visible, non-binary field columns of the current list arch — the
     * ones a user actually sees, and the ones whose formatted value is
     * searched.
     *
     * @returns {Array<Object>}
     */
    get x2mSearchableColumns() {
        if (!this.x2mSearchBoxVisible) {
            return [];
        }
        const columns = (this.archInfo && this.archInfo.columns) || [];
        return columns.filter((column) => {
            if (column.type !== "field") {
                return false;
            }
            if (
                column.column_invisible &&
                this.evalInvisible(column.column_invisible)
            ) {
                return false;
            }
            const field = this.list.fields[column.name];
            return Boolean(field) && field.type !== "binary";
        });
    }

    /**
     * @param {Object} record
     * @param {String} needle already lower-cased, already trimmed
     * @returns {Boolean}
     */
    x2mSearchRecordMatches(record, needle) {
        for (const column of this.x2mSearchableColumns) {
            const field = this.list.fields[column.name];
            let formatted = "";
            try {
                const formatter = formatters.get(field.type, (value) =>
                    value ? String(value) : ""
                );
                formatted = formatter(record.data[column.name], {
                    field,
                    data: record.data,
                });
            } catch {
                formatted = "";
            }
            if (String(formatted).toLowerCase().includes(needle)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Toggles `o_x2m_search_hidden` on every rendered data row depending
     * on whether its record matches the current search box value. Called
     * after every render (`onRendered`), so it stays correct across
     * pagination, reload after save, and the user typing.
     */
    applyX2mSearchFilter() {
        if (!this.x2mSearchBoxVisible) {
            return;
        }
        const root = this.x2mSearchRootRef.el;
        if (!root) {
            return;
        }
        const needle = this.x2mSearchState.value.trim().toLowerCase();
        const rows = root.querySelectorAll(".o_data_row[data-id]");
        for (const row of rows) {
            if (!needle) {
                row.classList.remove("o_x2m_search_hidden");
                continue;
            }
            const record = this.list.records.find((r) => r.id === row.dataset.id);
            const visible =
                !record || record.isNew || this.x2mSearchRecordMatches(record, needle);
            row.classList.toggle("o_x2m_search_hidden", !visible);
        }
    }
}

export const x2mSearchField = {
    ...x2ManyField,
    component: X2mSearchField,
    displayName: _t("Relational table (with search)"),
};

registry.category("fields").add("x2m_search", x2mSearchField);
