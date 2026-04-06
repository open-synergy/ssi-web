// Copyright 2025 OpenSynergy Indonesia
// Copyright 2025 PT. Simetri Sinergi Indonesia
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

odoo.define("ssi_web_widget_x2m_excel_download.x2m_excel_download", function (require) {
    "use strict";

    var relationalFields = require("web.relational_fields");
    var rpc = require("web.rpc");
    var session = require("web.session");

    var FieldOne2Many = relationalFields.FieldOne2Many;
    var FieldMany2Many = relationalFields.FieldMany2Many;

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    function fieldToString(value, field) {
        if (value === undefined || value === null || value === false) {
            return "";
        }
        var type = field ? field.type : null;
        if (type === "many2one") {
            if (Array.isArray(value)) {
                return value.length > 1 ? String(value[1]) : "";
            }
            if (value && typeof value === "object" && value.data) {
                return value.data.display_name || "";
            }
            return String(value);
        }
        if (type === "selection" && field.selection) {
            for (var i = 0; i < field.selection.length; i++) {
                if (field.selection[i][0] === value) {
                    return String(field.selection[i][1]);
                }
            }
            return String(value);
        }
        if (type === "boolean") {
            return value ? "Yes" : "No";
        }
        if (type === "one2many" || type === "many2many") {
            return Array.isArray(value) ? value.join(", ") : "";
        }
        if (typeof value === "object" && value !== null) {
            return value.data && value.data.display_name
                ? String(value.data.display_name)
                : "";
        }
        return String(value);
    }

    function resolveFields(widget) {
        if (widget.field && widget.field.views) {
            var v = widget.field.views;
            if (v.list && v.list.fields) {
                return v.list.fields;
            }
            if (v.tree && v.tree.fields) {
                return v.tree.fields;
            }
        }
        if (
            widget.record &&
            widget.record.fields &&
            widget.record.fields[widget.name]
        ) {
            var rf = widget.record.fields[widget.name];
            if (rf.views) {
                if (rf.views.list && rf.views.list.fields) {
                    return rf.views.list.fields;
                }
                if (rf.views.tree && rf.views.tree.fields) {
                    return rf.views.tree.fields;
                }
            }
        }
        if (widget.renderer && widget.renderer.state && widget.renderer.state.fields) {
            return widget.renderer.state.fields;
        }
        return {};
    }

    function resolveColumns(widget) {
        if (widget.renderer && widget.renderer.columns) {
            return widget.renderer.columns;
        }
        if (widget.renderer && widget.renderer.arch && widget.renderer.arch.children) {
            return widget.renderer.arch.children;
        }
        return [];
    }

    function getVisibleCols(archCols, fields) {
        var result = [];
        for (var i = 0; i < archCols.length; i++) {
            var col = archCols[i];
            if (col.tag !== "field") {
                continue;
            }
            var name = col.attrs && col.attrs.name;
            if (!name) {
                continue;
            }
            var fld = fields[name];
            if (!fld) {
                continue;
            }
            if (fld.type === "one2many" || fld.type === "many2many") {
                continue;
            }
            var mods = {};
            if (col.attrs && col.attrs.modifiers) {
                try {
                    mods =
                        typeof col.attrs.modifiers === "string"
                            ? JSON.parse(col.attrs.modifiers)
                            : col.attrs.modifiers;
                } catch (_e) {
                    mods = {};
                }
            }
            if (mods.invisible === true || mods.column_invisible === true) {
                continue;
            }
            if (col.attrs) {
                if (col.attrs.invisible === "1" || col.attrs.column_invisible === "1") {
                    continue;
                }
            }
            result.push({
                name: name,
                string: (col.attrs && col.attrs.string) || fld.string || name,
            });
        }
        return result;
    }

    function buildRows(records, columns, fields) {
        var header = [];
        var c = 0;
        for (c = 0; c < columns.length; c++) {
            header.push(columns[c].string);
        }
        var rows = [header];
        for (var r = 0; r < records.length; r++) {
            var data = records[r].data || records[r];
            var row = [];
            for (c = 0; c < columns.length; c++) {
                row.push(fieldToString(data[columns[c].name], fields[columns[c].name]));
            }
            rows.push(row);
        }
        return rows;
    }

    function isEnabled(widget) {
        var opts = widget.nodeOptions || {};
        if (
            Object.prototype.hasOwnProperty.call(opts, "excel_download") &&
            !opts.excel_download
        ) {
            return false;
        }
        return true;
    }

    // ----------------------------------------------------------------
    // Get ALL record IDs across all pages
    // ----------------------------------------------------------------

    function getAllIds(widget) {
        var name = widget.name;
        var record = widget.record;
        var ids = null,
            d = 0;

        // Try model.get()
        try {
            var dp = widget.model.get(record.id);
            if (dp && dp.data && dp.data[name]) {
                var list = dp.data[name];
                if (list.res_ids && list.res_ids.length) {
                    return list.res_ids.slice();
                }
                if (list.data && list.data.length) {
                    ids = [];
                    for (d = 0; d < list.data.length; d++) {
                        ids.push(list.data[d].res_id || list.data[d].id);
                    }
                    if (ids.length) {
                        return ids;
                    }
                }
            }
        } catch (e) {
            // Fallback - model.get() not available
            void e;
        }

        // Renderer state
        if (widget.renderer && widget.renderer.state) {
            var st = widget.renderer.state;
            if (st.res_ids && st.res_ids.length) {
                return st.res_ids.slice();
            }
            if (st.data && st.data.length) {
                ids = [];
                for (d = 0; d < st.data.length; d++) {
                    ids.push(st.data[d].res_id || st.data[d].id);
                }
                if (ids.length) {
                    return ids;
                }
            }
        }

        // Record.data
        if (record.data && record.data[name]) {
            var val = record.data[name];
            if (val.res_ids && val.res_ids.length) {
                return val.res_ids.slice();
            }
            if (val.data && val.data.length) {
                ids = [];
                for (d = 0; d < val.data.length; d++) {
                    ids.push(val.data[d].res_id || val.data[d].id);
                }
                return ids;
            }
        }
        return [];
    }

    // ----------------------------------------------------------------
    // Batch RPC fetch
    // ----------------------------------------------------------------

    function fetchAll(widget, columns, fields, onProgress) {
        var fi = widget.record.fields[widget.name];
        var model = fi ? fi.relation : null;
        if (!model) {
            return Promise.resolve([]);
        }
        var allIds = getAllIds(widget);
        if (!allIds.length) {
            return Promise.resolve([]);
        }
        var total = allIds.length;
        var realIds = [];
        var virtualIds = [];
        var i = 0;
        for (i = 0; i < allIds.length; i++) {
            if (typeof allIds[i] === "number" && allIds[i] > 0) {
                realIds.push(allIds[i]);
            } else {
                virtualIds.push(allIds[i]);
            }
        }

        var virtRecs = [];
        for (i = 0; i < virtualIds.length; i++) {
            try {
                var dp = widget.model.get(virtualIds[i]);
                if (dp) {
                    virtRecs.push(dp);
                }
            } catch (e) {
                // Skip virtual record
                void e;
            }
        }

        var fnames = [];
        for (i = 0; i < columns.length; i++) {
            fnames.push(columns[i].name);
        }

        if (!realIds.length) {
            if (onProgress) {
                onProgress(total, total);
            }
            return Promise.resolve(buildRows(virtRecs, columns, fields));
        }

        var BATCH = 500;
        var batches = [];
        for (i = 0; i < realIds.length; i += BATCH) {
            batches.push(realIds.slice(i, i + BATCH));
        }

        var loaded = virtualIds.length;
        var map = {};
        var chain = Promise.resolve();
        for (var bi = 0; bi < batches.length; bi++) {
            (function (ids) {
                chain = chain.then(function () {
                    return rpc
                        .query({
                            model: model,
                            method: "read",
                            args: [ids, fnames],
                            kwargs: {context: session.user_context},
                        })
                        .then(function (res) {
                            loaded += res.length;
                            if (onProgress) {
                                onProgress(loaded, total);
                            }
                            for (var j = 0; j < res.length; j++) {
                                map[res[j].id] = {data: res[j]};
                            }
                        });
                });
            })(batches[bi]);
        }

        return chain.then(function () {
            var ordered = [];
            for (var k = 0; k < allIds.length; k++) {
                var id = allIds[k];
                if (typeof id === "number" && id > 0 && map[id]) {
                    ordered.push(map[id]);
                } else if (typeof id !== "number" || id <= 0) {
                    try {
                        var r = widget.model.get(id);
                        if (r) {
                            ordered.push(r);
                        }
                    } catch (e) {
                        // Skip record fetch error
                        void e;
                    }
                }
            }
            return buildRows(ordered, columns, fields);
        });
    }

    // ----------------------------------------------------------------
    // Download handler
    // ----------------------------------------------------------------

    function doDownload(widget, btnEl, statusEl) {
        var fields = resolveFields(widget);
        var archCols = resolveColumns(widget);
        if (!archCols.length) {
            statusEl.textContent = "No columns found.";
            return;
        }
        var columns = getVisibleCols(archCols, fields);
        if (!columns.length) {
            statusEl.textContent = "No visible columns to export.";
            return;
        }
        var allIds = getAllIds(widget);
        if (!allIds.length) {
            statusEl.textContent = "No records to export.";
            return;
        }
        var total = allIds.length;
        var fname = widget.name || "export";
        if (widget.record && widget.record.data && widget.record.data.display_name) {
            fname = widget.record.data.display_name + " - " + fname;
        }
        btnEl.disabled = true;
        statusEl.textContent = "Preparing " + total + " records...";

        fetchAll(widget, columns, fields, function (n, t) {
            statusEl.textContent = "Fetching " + n + " / " + t + "...";
        })
            .then(function (data) {
                if (!data || data.length <= 1) {
                    statusEl.textContent = "No data to export.";
                    btnEl.disabled = false;
                    return;
                }
                statusEl.textContent = "Generating file...";
                try {
                    if (
                        !window.SsiXlsxWriter ||
                        typeof window.SsiXlsxWriter.downloadXlsx !== "function"
                    ) {
                        throw new Error(
                            "SsiXlsxWriter not loaded. Check assets loading order."
                        );
                    }
                    window.SsiXlsxWriter.downloadXlsx(data, fname);
                    statusEl.textContent =
                        "Exported " + (data.length - 1) + " records.";
                } catch (e) {
                    console.error("[x2m_excel] Write error:", e);
                    statusEl.textContent = "Error: " + e.message;
                }
                btnEl.disabled = false;
            })
            .catch(function (err) {
                console.error("[x2m_excel] Fetch error:", err);
                var msg = "Unknown error";
                if (err && err.message) {
                    msg = err.message;
                } else if (err && err.data && err.data.message) {
                    msg = err.data.message;
                }
                statusEl.textContent = "Error: " + msg;
                btnEl.disabled = false;
            });
    }

    // ----------------------------------------------------------------
    // Inject bar
    // ----------------------------------------------------------------

    function injectBar(widget) {
        if (!isEnabled(widget)) {
            return;
        }
        var el = widget.el || (widget.$el && widget.$el[0]);
        if (!el) {
            return;
        }

        // Check if renderer has columns (list mode). If not, skip
        // (e.g. FieldMany2ManyTags does not have a renderer with columns)
        if (!widget.renderer || !widget.renderer.columns) {
            return;
        }

        // Remove existing
        var ch = el.children;
        var rm = [];
        for (var i = 0; i < ch.length; i++) {
            if (ch[i].classList.contains("o_x2m_excel_download_bar")) {
                rm.push(ch[i]);
            }
        }
        for (var j = 0; j < rm.length; j++) {
            el.removeChild(rm[j]);
        }

        var bar = document.createElement("div");
        bar.className = "o_x2m_excel_download_bar";

        var status = document.createElement("span");
        status.className = "o_x2m_excel_download_status";

        var btn = document.createElement("button");
        btn.setAttribute("type", "button");
        btn.className = "btn btn-sm btn-outline-success o_x2m_excel_download_btn";

        var icon = document.createElement("i");
        icon.className = "fa fa-file-excel-o";
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(" Download Excel"));

        bar.appendChild(status);
        bar.appendChild(btn);

        // Capture widget ref and bind with native addEventListener
        // Use capture phase (3rd arg = true) to fire before Odoo delegation
        var wRef = widget;
        btn.addEventListener(
            "click",
            function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                doDownload(wRef, btn, status);
                return false;
            },
            true
        );

        // Also block mousedown from triggering Odoo logic
        btn.addEventListener(
            "mousedown",
            function (ev) {
                ev.stopPropagation();
            },
            true
        );

        if (el.firstChild) {
            el.insertBefore(bar, el.firstChild);
        } else {
            el.appendChild(bar);
        }
    }

    // ----------------------------------------------------------------
    // Patch FieldOne2Many
    // ----------------------------------------------------------------

    FieldOne2Many.include({
        /**
         * After rendering, inject the download bar if excel_download
         * is not explicitly disabled.
         */
        _render: function () {
            var self = this;
            var sup = this._super.apply(this, arguments);
            // _super may return Promise, jQuery Deferred, or undefined
            if (sup && typeof sup.then === "function") {
                return sup.then(function () {
                    injectBar(self);
                });
            }
            // Sync path
            injectBar(self);
            return Promise.resolve();
        },
    });

    // ----------------------------------------------------------------
    // Patch FieldMany2Many (only when rendered as list)
    // ----------------------------------------------------------------

    FieldMany2Many.include({
        /**
         * After rendering, inject the download bar if it uses a list renderer.
         */
        _render: function () {
            var self = this;
            var sup = this._super.apply(this, arguments);
            if (sup && typeof sup.then === "function") {
                return sup.then(function () {
                    injectBar(self);
                });
            }
            injectBar(self);
            return Promise.resolve();
        },
    });
});
