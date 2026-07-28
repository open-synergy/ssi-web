/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyModel", function (require) {
    "use strict";

    const AbstractModel = require("web.AbstractModel");

    // Root nodes are paginated like any other list view. Only the roots
    // are: children of an open node are never paginated (see README).
    const ROOT_PAGE_SIZE = 80;

    /**
     * @param {*} value a one2many/many2many value read by search_read/read
     * @returns {Array} the plain array of ids it carries
     */
    function toIds(value) {
        return Array.isArray(value) ? value : [];
    }

    const HierarchyModel = AbstractModel.extend({
        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this.rows = {};
            this.rootKeys = [];
            this.rootCount = 0;
            this.offset = 0;
            this.limitReached = false;
        },

        /**
         * @override
         */
        __get: function () {
            return {
                rows: this.rows,
                rootKeys: this.rootKeys,
                rootCount: this.rootCount,
                offset: this.offset,
                limit: this.rootLimit,
                nodeLimit: this.nodeLimit,
                loadedCount: Object.keys(this.rows).length,
                limitReached: this.limitReached,
            };
        },

        /**
         * @override
         */
        __load: function (params) {
            this.modelName = params.modelName;
            this.fieldNames = params.fieldNames;
            this.childField = params.childField;
            this.parentField = params.parentField;
            this.defaultExpand = params.defaultExpand;
            this.nodeLimit = params.limit;
            this.domain = params.domain || [];
            this.context = params.context || {};
            this.rootLimit = ROOT_PAGE_SIZE;
            this.offset = 0;
            return this._fetchRoots().then(() => this._applyDefaultExpand());
        },

        /**
         * @override
         */
        __reload: function (handle, params) {
            const options = params || {};
            if (options.context !== undefined) {
                this.context = options.context;
            }
            if (options.domain !== undefined) {
                this.domain = options.domain;
                if (options.offset === undefined) {
                    this.offset = 0;
                }
            }
            if (options.offset !== undefined) {
                this.offset = options.offset;
            }
            if (options.limit !== undefined) {
                this.rootLimit = options.limit;
            }
            return this._fetchRoots().then(() => this._applyDefaultExpand());
        },

        // --------------------------------------------------------------------
        // Public
        // --------------------------------------------------------------------

        /**
         * Opens or closes a node. Opening a node that was never opened
         * before fetches its children first; a node collapsed earlier keeps
         * its children cached, so reopening it is free.
         *
         * @param {String} rowKey
         * @returns {Promise}
         */
        toggleNode: function (rowKey) {
            const row = this.rows[rowKey];
            if (!row || !row.hasChildren) {
                return Promise.resolve();
            }
            if (row.isOpen) {
                row.isOpen = false;
                return Promise.resolve();
            }
            return this._openNode(row);
        },

        /**
         * Loads and opens every node reachable from the current roots, one
         * level at a time, up to ``nodeLimit`` nodes held in memory at once.
         * Stops rather than errors when the limit is hit; the caller (the
         * controller) is expected to warn the user about the partial
         * expansion.
         *
         * @returns {Promise<Boolean>} resolved with true if the limit was hit
         */
        expandAll: function () {
            this.limitReached = false;
            const expandLevel = (rowKeys) => {
                const openable = rowKeys.filter(
                    (key) => this.rows[key].hasChildren && !this.rows[key].isOpen
                );
                if (!openable.length || this.limitReached) {
                    return Promise.resolve();
                }
                return Promise.all(
                    openable.map((key) => this._openNode(this.rows[key]))
                ).then(() => {
                    const nextLevel = [];
                    openable.forEach((key) => {
                        for (const childKey of this.rows[key].childKeys || []) {
                            nextLevel.push(childKey);
                        }
                    });
                    return expandLevel(nextLevel);
                });
            };
            return expandLevel(this.rootKeys.slice()).then(() => this.limitReached);
        },

        /**
         * Closes every currently open node without discarding the cached
         * children, so reopening any of them afterwards is instantaneous.
         */
        collapseAll: function () {
            for (const key of Object.keys(this.rows)) {
                this.rows[key].isOpen = false;
            }
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * Opens a node, loading its children first if they were never
         * fetched. Refuses to grow past ``nodeLimit`` nodes in memory.
         *
         * @private
         * @param {Object} row
         * @returns {Promise}
         */
        _openNode: function (row) {
            if (row.isLoaded) {
                row.isOpen = true;
                return Promise.resolve();
            }
            if (Object.keys(this.rows).length >= this.nodeLimit) {
                this.limitReached = true;
                return Promise.resolve();
            }
            return this._fetchChildren(row).then(() => {
                row.isOpen = true;
            });
        },

        /**
         * @private
         * @returns {Promise}
         */
        _fetchRoots: function () {
            const domain = this._rootDomain();
            return Promise.all([
                this._rpc({
                    model: this.modelName,
                    method: "search_count",
                    args: [domain],
                    context: this.context,
                }),
                this._rpc({
                    model: this.modelName,
                    method: "search_read",
                    kwargs: {
                        domain: domain,
                        fields: this.fieldNames,
                        offset: this.offset,
                        limit: this.rootLimit,
                        context: this.context,
                    },
                }),
            ]).then(([count, records]) => {
                this.rows = {};
                this.limitReached = false;
                this.rootCount = count;
                this.rootKeys = records.map((record) =>
                    this._registerRow(record, false, 0)
                );
                return this._computeHasChildren(this.rootKeys);
            });
        },

        /**
         * @private
         * @returns {Array} the domain roots are searched with
         */
        _rootDomain: function () {
            const domain = this.domain.slice();
            if (this.parentField) {
                domain.push([this.parentField, "=", false]);
            }
            return domain;
        },

        /**
         * Registers one record as a row of the tree and returns its key.
         *
         * @private
         * @param {Object} record
         * @param {String|Boolean} parentKey
         * @param {Number} level
         * @returns {String}
         */
        _registerRow: function (record, parentKey, level) {
            const key = (parentKey || "root") + "/" + record.id;
            this.rows[key] = {
                key: key,
                id: record.id,
                parentKey: parentKey,
                level: level,
                data: record,
                hasChildren: this.childField
                    ? toIds(record[this.childField]).length > 0
                    : false,
                isOpen: false,
                isLoaded: false,
                childKeys: null,
            };
            return key;
        },

        /**
         * Determines which of the given rows have children, one batched
         * query for the whole set rather than one query per row. A no-op
         * when ``child_field`` is set: in that mode every row already
         * carries its own children ids, so the answer is already known.
         *
         * @private
         * @param {Array} rowKeys
         * @returns {Promise}
         */
        _computeHasChildren: function (rowKeys) {
            if (this.childField || !this.parentField || !rowKeys.length) {
                return Promise.resolve();
            }
            const ids = rowKeys.map((key) => this.rows[key].id);
            const countField = this.parentField + "_count";
            return this._rpc({
                model: this.modelName,
                method: "read_group",
                kwargs: {
                    domain: [[this.parentField, "in", ids]],
                    fields: [this.parentField],
                    groupby: [this.parentField],
                    context: this.context,
                },
            }).then((groups) => {
                const withChildren = new Set();
                for (const group of groups) {
                    if (!group[countField]) {
                        continue;
                    }
                    const value = group[this.parentField];
                    withChildren.add(Array.isArray(value) ? value[0] : value);
                }
                for (const key of rowKeys) {
                    this.rows[key].hasChildren = withChildren.has(this.rows[key].id);
                }
            });
        },

        /**
         * @private
         * @param {Object} row
         * @returns {Promise}
         */
        _fetchChildren: function (row) {
            row.isLoaded = true;
            if (this.childField) {
                return this._fetchChildrenByField(row);
            }
            return this._fetchChildrenByParent(row);
        },

        /**
         * Reads the children ids already carried by ``child_field`` on the
         * parent record: no domain search is needed at all.
         *
         * @private
         * @param {Object} row
         * @returns {Promise}
         */
        _fetchChildrenByField: function (row) {
            const ids = toIds(row.data[this.childField]);
            row.childKeys = [];
            if (!ids.length) {
                return Promise.resolve();
            }
            return this._rpc({
                model: this.modelName,
                method: "read",
                args: [ids, this.fieldNames],
                context: this.context,
            }).then((records) => {
                const byId = {};
                records.forEach((record) => {
                    byId[record.id] = record;
                });
                // `read` does not guarantee the order of `ids` is preserved.
                row.childKeys = ids
                    .filter((id) => byId[id])
                    .map((id) => this._registerRow(byId[id], row.key, row.level + 1));
            });
        },

        /**
         * Searches for the records whose ``parent_field`` points at this
         * row, then batch-computes which of them have children of their
         * own.
         *
         * @private
         * @param {Object} row
         * @returns {Promise}
         */
        _fetchChildrenByParent: function (row) {
            return this._rpc({
                model: this.modelName,
                method: "search_read",
                kwargs: {
                    domain: [[this.parentField, "=", row.id]],
                    fields: this.fieldNames,
                    context: this.context,
                },
            }).then((records) => {
                row.childKeys = records.map((record) =>
                    this._registerRow(record, row.key, row.level + 1)
                );
                return this._computeHasChildren(row.childKeys);
            });
        },

        /**
         * Auto-opens the top ``defaultExpand`` levels below the roots after
         * every (re)load.
         *
         * @private
         * @returns {Promise}
         */
        _applyDefaultExpand: function () {
            if (!this.defaultExpand) {
                return Promise.resolve();
            }
            const expandLevel = (rowKeys, depth) => {
                if (depth > this.defaultExpand || !rowKeys.length) {
                    return Promise.resolve();
                }
                const openable = rowKeys.filter((key) => this.rows[key].hasChildren);
                if (!openable.length) {
                    return Promise.resolve();
                }
                return Promise.all(
                    openable.map((key) => this._openNode(this.rows[key]))
                ).then(() => {
                    const nextLevel = [];
                    openable.forEach((key) => {
                        for (const childKey of this.rows[key].childKeys || []) {
                            nextLevel.push(childKey);
                        }
                    });
                    return expandLevel(nextLevel, depth + 1);
                });
            };
            return expandLevel(this.rootKeys.slice(), 1);
        },
    });

    return HierarchyModel;
});
