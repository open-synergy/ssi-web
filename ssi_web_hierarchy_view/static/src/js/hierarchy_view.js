/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyView", function (require) {
    "use strict";

    const AbstractView = require("web.AbstractView");
    const core = require("web.core");
    const view_registry = require("web.view_registry");
    const HierarchyController = require("ssi_web_hierarchy_view.HierarchyController");
    const HierarchyModel = require("ssi_web_hierarchy_view.HierarchyModel");
    const HierarchyRenderer = require("ssi_web_hierarchy_view.HierarchyRenderer");

    const _lt = core._lt;

    const DEFAULT_EXPAND = 0;
    const DEFAULT_LIMIT = 1000;

    const HierarchyView = AbstractView.extend({
        display_name: _lt("Hierarchy"),
        icon: "fa-sitemap",
        config: _.extend({}, AbstractView.prototype.config, {
            Model: HierarchyModel,
            Controller: HierarchyController,
            Renderer: HierarchyRenderer,
        }),
        // AbstractController reads this to build the controller state, and
        // thus the view_type of the URL. Leaving it unset breaks the URL
        // silently.
        viewType: "hierarchy",
        multi_record: true,
        // No groupBy: grouping records would collide with the hierarchy
        // itself, which is already a grouping of sorts.
        searchMenuTypes: ["filter", "favorite"],

        /**
         * @override
         */
        init: function (viewInfo) {
            this._super.apply(this, arguments);
            const attrs = this.arch.attrs;
            const fields = viewInfo.fields;

            const columns = this._buildColumns(fields);
            const childField = attrs.child_field || false;
            const parentField = attrs.parent_field || false;
            const defaultExpand = parseInt(attrs.default_expand, 10) || DEFAULT_EXPAND;
            const limit = parseInt(attrs.limit, 10) || DEFAULT_LIMIT;

            this.rendererParams.columns = columns;
            this.rendererParams.fields = fields;

            this.loadParams.modelName = this.controllerParams.modelName;
            this.loadParams.fieldNames = this._fieldNames(
                columns,
                childField,
                parentField
            );
            this.loadParams.childField = childField;
            this.loadParams.parentField = parentField;
            this.loadParams.defaultExpand = defaultExpand;
            this.loadParams.limit = limit;

            this.withSearchPanel = false;
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * The first ``<field>`` child of the arch is the hierarchy column
         * (indentation + toggle); every other one is a plain column.
         * Without any ``<field>`` at all, the hierarchy column falls back
         * to ``display_name`` in the renderer.
         *
         * @private
         * @param {Object} fields viewInfo.fields
         * @returns {Array} [{name, label}]
         */
        _buildColumns: function (fields) {
            const columns = [];
            for (const child of this.arch.children) {
                if (child.tag === "field" && child.attrs.name) {
                    const field = fields[child.attrs.name] || {};
                    columns.push({
                        name: child.attrs.name,
                        label: child.attrs.string || field.string || child.attrs.name,
                    });
                }
            }
            return columns;
        },

        /**
         * Every field the tree reads has to be fetched by search_read/read:
         * the columns, plus ``child_field``/``parent_field`` themselves so
         * the model can tell whether a row has children and, in
         * ``child_field`` mode, read them without an extra search.
         *
         * @private
         * @param {Array} columns
         * @param {String|Boolean} childField
         * @param {String|Boolean} parentField
         * @returns {Array}
         */
        _fieldNames: function (columns, childField, parentField) {
            const names = ["display_name"];
            for (const column of columns) {
                names.push(column.name);
            }
            if (childField) {
                names.push(childField);
            }
            if (parentField) {
                names.push(parentField);
            }
            return _.uniq(names);
        },
    });

    view_registry.add("hierarchy", HierarchyView);

    return HierarchyView;
});
