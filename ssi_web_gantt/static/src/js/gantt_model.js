/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.GanttModel", function (require) {
    "use strict";

    const AbstractModel = require("web.AbstractModel");
    const core = require("web.core");

    const _t = core._t;

    /**
     * @param {*} value a value read by search_read
     * @returns {Number|false} the id of a many2one value
     */
    function many2oneId(value) {
        if (Array.isArray(value)) {
            return value.length ? value[0] : false;
        }
        return value || false;
    }

    const GanttModel = AbstractModel.extend({
        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this.rightsDef = null;
            this.rights = {create: false, write: false, unlink: false};
        },

        /**
         * The renderer reads this.state, and AbstractRenderer itself reads
         * state.isSample, so an object has to be returned here. Overriding
         * ``get`` instead of ``__get`` would break that contract.
         *
         * @override
         */
        __get: function () {
            return this.data || {};
        },

        /**
         * @override
         */
        _isEmpty: function () {
            return !this.data || !this.data.records.length;
        },

        /**
         * The search view hands the group by over as ``groupedBy`` on the
         * initial load, but as ``groupBy`` on every subsequent reload. Missing
         * either one makes the Group By menu appear to work once and then
         * silently stop.
         *
         * @override
         */
        __load: function (params) {
            this.modelName = params.modelName;
            this.fieldNames = params.fieldNames;
            this.fields = params.fields;
            this.cfg = params.cfg;
            this.defaultGroupBy = params.defaultGroupBy;
            this.data = {
                records: [],
                links: [],
                groups: [],
                rights: this.rights,
                domain: params.domain || [],
                context: params.context || {},
            };
            this.groupBy = this._normalizeGroupBy(params.groupedBy);
            return this._loadRights().then(this._fetch.bind(this));
        },

        /**
         * @override
         */
        __reload: function (handle, params) {
            const options = params || {};
            if (options.domain !== undefined) {
                this.data.domain = options.domain;
            }
            if (options.context !== undefined) {
                this.data.context = options.context;
            }
            const groupBy =
                options.groupBy === undefined ? options.groupedBy : options.groupBy;
            if (groupBy !== undefined) {
                this.groupBy = this._normalizeGroupBy(groupBy);
            }
            return this._loadRights().then(this._fetch.bind(this));
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * @private
         * @param {Array} groupBy
         * @returns {Array}
         */
        _normalizeGroupBy: function (groupBy) {
            if (groupBy && groupBy.length) {
                return groupBy;
            }
            return this.defaultGroupBy || [];
        },

        /**
         * The server never derives create/edit/delete rights for this tag, so
         * they have to be asked for explicitly.
         *
         * @private
         * @returns {Promise}
         */
        _loadRights: function () {
            if (!this.rightsDef) {
                this.rightsDef = Promise.all([
                    this._rpc({
                        model: this.modelName,
                        method: "check_access_rights",
                        args: ["write", false],
                    }),
                    this._rpc({
                        model: this.modelName,
                        method: "check_access_rights",
                        args: ["unlink", false],
                    }),
                    this._rpc({
                        model: this.modelName,
                        method: "check_access_rights",
                        args: ["create", false],
                    }),
                ]).then((results) => {
                    this.rights = {
                        write: results[0],
                        unlink: results[1],
                        create: results[2],
                    };
                });
            }
            return this.rightsDef;
        },

        /**
         * A group by chosen from the search view is not in the arch, so its
         * field is absent from the arch field list. Without adding it here, the
         * value would never be fetched and every record would end up in the
         * "Undefined" bucket.
         *
         * @private
         * @returns {Array} the fields to read
         */
        _fetchedFields: function () {
            const names = this.fieldNames.slice();
            for (const groupBy of this.groupBy) {
                const name = groupBy.split(":")[0];
                if (this.fields[name] && !names.includes(name)) {
                    names.push(name);
                }
            }
            return names;
        },

        /**
         * @private
         * @returns {Promise}
         */
        _fetch: function () {
            return this._rpc({
                model: this.modelName,
                method: "search_read",
                kwargs: {
                    fields: this._fetchedFields(),
                    domain: this.data.domain,
                    context: this.data.context,
                },
            })
                .then((records) => {
                    this.data.records = records;
                    this.data.rights = this.rights;
                    return this._fetchLinks(records);
                })
                .then((links) => {
                    this.data.links = links;
                    this.data.groups = this._splitGroups(this.data.records);
                    return this.data;
                });
        },

        /**
         * @private
         * @param {Array} records
         * @returns {Promise} resolved with the dependency links
         */
        _fetchLinks: function (records) {
            if (!records.length) {
                return Promise.resolve([]);
            }
            const ids = records.map((record) => record.id);
            if (this.cfg.dependencyModel) {
                return this._fetchLinkRecords(ids);
            }
            if (this.cfg.dependencyField) {
                return Promise.resolve(this._buildLinksFromField(records, ids));
            }
            return Promise.resolve([]);
        },

        /**
         * Mode A: the links live in a dedicated model, so a second search_read
         * is needed.
         *
         * @private
         * @param {Array} ids
         * @returns {Promise}
         */
        _fetchLinkRecords: function (ids) {
            const cfg = this.cfg;
            const fields = [
                cfg.dependencyPredecessorField,
                cfg.dependencySuccessorField,
            ];
            if (cfg.dependencyTypeField) {
                fields.push(cfg.dependencyTypeField);
            }
            if (cfg.dependencyLagField) {
                fields.push(cfg.dependencyLagField);
            }
            // The OR deliberately over-fetches: it returns every link touching
            // the window, and both endpoints are then checked in JS. Turning it
            // into an AND would change the semantics and close the door on
            // rendering links to off-screen records later on.
            const endpoints = [
                "|",
                [cfg.dependencyPredecessorField, "in", ids],
                [cfg.dependencySuccessorField, "in", ids],
            ];
            const domain = (cfg.dependencyDomain || []).concat(endpoints);
            const known = new Set(ids);
            return this._rpc({
                model: cfg.dependencyModel,
                method: "search_read",
                kwargs: {
                    fields: fields,
                    domain: domain,
                    context: this.data.context,
                },
            }).then((links) => {
                const result = [];
                for (const link of links) {
                    const predecessor = many2oneId(
                        link[cfg.dependencyPredecessorField]
                    );
                    const successor = many2oneId(link[cfg.dependencySuccessorField]);
                    if (!predecessor || !successor || predecessor === successor) {
                        continue;
                    }
                    if (!known.has(predecessor) || !known.has(successor)) {
                        continue;
                    }
                    result.push({
                        id: link.id,
                        predecessor: predecessor,
                        successor: successor,
                        rawType: cfg.dependencyTypeField
                            ? link[cfg.dependencyTypeField]
                            : false,
                        lag: cfg.dependencyLagField
                            ? link[cfg.dependencyLagField] || 0
                            : 0,
                    });
                }
                return result;
            });
        },

        /**
         * Mode B: the links are an x2many on the model itself, whose ids came
         * along with the main search_read. No second round trip.
         *
         * @private
         * @param {Array} records
         * @param {Array} ids
         * @returns {Array}
         */
        _buildLinksFromField: function (records, ids) {
            const cfg = this.cfg;
            const known = new Set(ids);
            const seen = new Set();
            const result = [];
            const reversed = cfg.dependencyFieldDirection === "successor";
            for (const record of records) {
                for (const other of record[cfg.dependencyField] || []) {
                    const predecessor = reversed ? record.id : other;
                    const successor = reversed ? other : record.id;
                    if (predecessor === successor) {
                        continue;
                    }
                    if (!known.has(predecessor) || !known.has(successor)) {
                        continue;
                    }
                    const key = predecessor + "-" + successor;
                    if (seen.has(key)) {
                        continue;
                    }
                    seen.add(key);
                    result.push({
                        id: key,
                        predecessor: predecessor,
                        successor: successor,
                        rawType: false,
                        lag: 0,
                    });
                }
            }
            return result;
        },

        /**
         * Group the records client side. Only the first group by is honoured,
         * which is a documented limitation of this iteration.
         *
         * @private
         * @param {Array} records
         * @returns {Array} [{id, name, records}]
         */
        _splitGroups: function (records) {
            const groupBy = this.groupBy.length ? this.groupBy[0] : false;
            if (!groupBy) {
                return [{id: false, name: false, records: records}];
            }
            const fieldName = groupBy.split(":")[0];
            const field = this.fields[fieldName];
            if (!field) {
                return [{id: false, name: false, records: records}];
            }
            const groups = new Map();
            let undefinedGroup = null;
            for (const record of records) {
                const raw = record[fieldName];
                if (raw === false || raw === undefined || raw === null) {
                    if (!undefinedGroup) {
                        undefinedGroup = {
                            id: false,
                            name: _t("Undefined"),
                            records: [],
                        };
                    }
                    undefinedGroup.records.push(record);
                    continue;
                }
                const key = Array.isArray(raw) ? raw[0] : raw;
                if (!groups.has(key)) {
                    groups.set(key, {
                        id: key,
                        name: this._groupLabel(raw, field),
                        records: [],
                    });
                }
                groups.get(key).records.push(record);
            }
            const result = Array.from(groups.values());
            if (undefinedGroup) {
                result.push(undefinedGroup);
            }
            return result;
        },

        /**
         * @private
         * @param {*} raw
         * @param {Object} field the field description
         * @returns {String}
         */
        _groupLabel: function (raw, field) {
            if (Array.isArray(raw)) {
                return raw.length > 1 ? raw[1] : String(raw[0]);
            }
            if (field.type === "boolean") {
                return raw ? _t("Yes") : _t("No");
            }
            if (field.type === "selection" && field.selection) {
                for (const option of field.selection) {
                    if (option[0] === raw) {
                        return option[1];
                    }
                }
            }
            return String(raw);
        },
    });

    return GanttModel;
});
