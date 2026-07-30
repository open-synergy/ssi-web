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

    /**
     * @param {*} value a many2one value read by search_read/read, either
     *      false or a [id, display_name] pair
     * @returns {Number|Boolean} the id it carries, false when empty
     */
    function toId(value) {
        if (Array.isArray(value)) {
            return value.length ? value[0] : false;
        }
        return value || false;
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
            this.searchMode = false;
            this.searchTruncated = false;
            // Grand totals of the aggregated columns over the union of
            // the subtrees of the roots on screen, keyed by field name,
            // every record counted exactly once. Computed server side.
            // Empty when no column asks for a total at all.
            this.totals = {};
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
                searchMode: this.searchMode,
                searchTruncated: this.searchTruncated,
                totals: this.totals,
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
            this.aggregateFieldNames = params.aggregateFieldNames || [];
            this.defaultExpand = params.defaultExpand;
            this.nodeLimit = params.limit;
            this.domain = params.domain || [];
            // The domain the view is loaded with belongs to the action,
            // not to the search view: it is the baseline search mode is
            // measured against, so that clearing every filter goes back
            // to the full tree instead of staying in search mode forever.
            this.baseDomain = this.domain.slice();
            this.context = params.context || {};
            this.rootLimit = ROOT_PAGE_SIZE;
            this.offset = 0;
            return this._fetch();
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
            return this._fetch();
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
         * Builds the tree the current domain asks for: the search result
         * tree while a search view filter is active, the full lazy tree
         * otherwise.
         *
         * @private
         * @returns {Promise}
         */
        _fetch: function () {
            if (this._isSearchMode()) {
                return this._fetchSearchTree();
            }
            return this._fetchRoots().then(() => this._applyDefaultExpand());
        },

        /**
         * Search mode needs ``parent_field``: without it the parent chain
         * of a match cannot be walked upwards at all, so the view falls
         * back to flat filtering (see README). It also needs the search
         * view to have actually added something to the action's own
         * domain, otherwise every load would be a search.
         *
         * @private
         * @returns {Boolean}
         */
        _isSearchMode: function () {
            if (!this.parentField) {
                return false;
            }
            return (
                JSON.stringify(this.domain) !== JSON.stringify(this.baseDomain || [])
            );
        },

        /**
         * Loads the whole search result tree in two queries: one asking
         * the server for the matching ids plus the ids of their
         * ancestors, one reading the fields of that union in ``_order``.
         *
         * @private
         * @returns {Promise}
         */
        _fetchSearchTree: function () {
            return this._rpc({
                model: this.modelName,
                method: "hierarchy_search_ancestors",
                args: [this.domain, this.parentField],
                kwargs: {limit: this.nodeLimit},
                context: this.context,
            }).then((result) => {
                this.searchMode = true;
                this.searchTruncated = Boolean(result.truncated);
                this.limitReached = false;
                this.offset = 0;
                const ids = result.matches.concat(result.ancestors);
                if (!ids.length) {
                    this.rows = {};
                    this.rootKeys = [];
                    this.rootCount = 0;
                    this.totals = {};
                    return Promise.resolve();
                }
                return this._rpc({
                    model: this.modelName,
                    method: "search_read",
                    kwargs: {
                        domain: [["id", "in", ids]],
                        fields: this.fieldNames,
                        context: this.context,
                    },
                }).then((records) => {
                    this._buildSearchTree(records, result.matches);
                    // The whole result tree is already in memory here, so
                    // one single call covers every level of it at once.
                    return this._fetchAggregates(Object.keys(this.rows)).then(() =>
                        this._computeTotals()
                    );
                });
            });
        },

        /**
         * Turns the flat search result into a tree: a record whose parent
         * is part of the result becomes its child, every other record
         * becomes a root. Every node holding children is registered as
         * already loaded and already open, so the chain leading to a
         * match is visible without the user opening anything and without
         * ``default_expand`` having any say while the filter is active.
         *
         * @private
         * @param {Array} records the union of the matches and their
         *      ancestors, ordered by the model ``_order``
         * @param {Array} matchIds ids of the records matching the domain
         */
        _buildSearchTree: function (records, matchIds) {
            const matched = new Set(matchIds);
            const loaded = new Set(records.map((record) => record.id));
            const childrenOf = {};
            const roots = [];
            for (const record of records) {
                const parentId = toId(record[this.parentField]);
                if (parentId && loaded.has(parentId)) {
                    childrenOf[parentId] = childrenOf[parentId] || [];
                    childrenOf[parentId].push(record);
                } else {
                    roots.push(record);
                }
            }
            this.rows = {};
            const register = (record, parentKey, level) => {
                const key = this._registerRow(record, parentKey, level);
                const row = this.rows[key];
                const children = childrenOf[record.id] || [];
                row.isMatch = matched.has(record.id);
                row.hasChildren = children.length > 0;
                row.isLoaded = true;
                row.isOpen = children.length > 0;
                row.childKeys = children.map((child) =>
                    register(child, key, level + 1)
                );
                return key;
            };
            this.rootKeys = roots.map((record) => register(record, false, 0));
            this.rootCount = this.rootKeys.length;
        },

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
                this.searchMode = false;
                this.searchTruncated = false;
                this.rootCount = count;
                this.rootKeys = records.map((record) =>
                    this._registerRow(record, false, 0)
                );
                return this._computeHasChildren(this.rootKeys)
                    .then(() => this._fetchAggregates(this.rootKeys))
                    .then(() => this._computeTotals());
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
                // Only meaningful in search mode, where a row is either a
                // match or one of the ancestors dragged along with it.
                isMatch: false,
                // Subtree totals of the aggregated columns, keyed by field
                // name, own value of the row included. False until the
                // server answered, and for good when no column asks for a
                // total.
                aggregates: false,
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
         * Asks the server for the subtree total of every aggregated column
         * of a whole level, in one single call for every id of that level
         * rather than one call per node. A no-op when no column asks for a
         * total, so a tree without ``sum=`` costs nothing extra.
         *
         * @private
         * @param {Array} rowKeys the keys of one level of the tree
         * @returns {Promise}
         */
        _fetchAggregates: function (rowKeys) {
            if (!this.aggregateFieldNames.length || !rowKeys.length) {
                return Promise.resolve();
            }
            const ids = rowKeys.map((key) => this.rows[key].id);
            return this._rpc({
                model: this.modelName,
                method: "hierarchy_aggregate",
                args: [ids, this.aggregateFieldNames],
                kwargs: {
                    parent_field: this.parentField || null,
                    child_field: this.childField || null,
                },
                context: this.context,
            }).then((totals) => {
                for (const key of rowKeys) {
                    const row = this.rows[key];
                    // JSON turns the integer keys of the answer into
                    // strings; indexing with the number reaches them all
                    // the same.
                    row.aggregates = totals[row.id] || false;
                }
            });
        },

        /**
         * Asks the server for the grand total row: the total of every
         * aggregated column over the union of the subtrees of the roots
         * currently on screen, every record counted exactly once.
         *
         * Adding up the subtree totals of the roots here instead would be
         * wrong as soon as one root is a descendant of another one, which
         * is exactly what a ``child_field``-only view produces, since
         * every record matching the domain is a root there. The server
         * merges the subtrees before summing, so the deduplication cannot
         * be skipped by the browser.
         *
         * Called only when the set of roots changes — first load, new
         * domain, new page of the pager, entering or leaving search mode.
         * Opening a node leaves the roots untouched and therefore leaves
         * the grand total untouched too, so it costs no call at all.
         *
         * @private
         * @returns {Promise}
         */
        _computeTotals: function () {
            this.totals = {};
            if (!this.aggregateFieldNames.length) {
                return Promise.resolve();
            }
            const ids = this.rootKeys.map((key) => this.rows[key].id);
            if (!ids.length) {
                for (const name of this.aggregateFieldNames) {
                    this.totals[name] = 0;
                }
                return Promise.resolve();
            }
            return this._rpc({
                model: this.modelName,
                method: "hierarchy_grand_total",
                args: [ids, this.aggregateFieldNames],
                kwargs: {
                    parent_field: this.parentField || null,
                    child_field: this.childField || null,
                },
                context: this.context,
            }).then((totals) => {
                this.totals = totals;
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
                return this._fetchAggregates(row.childKeys);
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
                return this._computeHasChildren(row.childKeys).then(() =>
                    this._fetchAggregates(row.childKeys)
                );
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
