// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

odoo.define("ssi_web_x2m_search.x2m_search", function (require) {
    "use strict";

    var ActionModel = require("web/static/src/js/views/action_model.js");
    var ControlPanel = require("web.ControlPanel");
    var ControlPanelX2ManySearch = require("ssi_web_x2m_search.ControlPanelX2ManySearch");
    var OwlCompatibility = require("web.OwlCompatibility");
    var relationalFields = require("web.relational_fields");
    var rpc = require("web.rpc");

    var ComponentWrapper = OwlCompatibility.ComponentWrapper;

    // Widgets rendering an x2many with the standard list renderer. Any other
    // widget (section_and_note_one2many, x2many_2d_matrix, many2many_tags, ...)
    // brings its own renderer and layout, and must be left untouched.
    var STANDARD_WIDGETS = ["one2many", "many2many"];

    // Field types that cannot be searched in a meaningful way.
    var UNSEARCHABLE_TYPES = ["binary"];

    var DEFAULT_PAGE_SIZE = 40;

    /**
     * A row that has not been saved yet holds a virtual id, which is a string.
     *
     * @param {Object} record
     * @returns {Boolean}
     */
    function isNewRow(record) {
        return typeof record.res_id !== "number" || record.res_id <= 0;
    }

    /**
     * Adds the standard Odoo search bar to every x2many field rendered as a list.
     *
     * The filter is applied on the view layer only: the list datapoint held by the
     * BasicModel is never touched. This is not a detail. BasicModel builds the save
     * commands out of `list.res_ids` (`replace_with` for many2many, and a diff of
     * res_ids for one2many), so narrowing res_ids down to the matching rows would
     * silently unlink every hidden row on save.
     */
    var X2mSearchMixin = {
        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this.x2mSearchModel = null;
            // Set of matching res_ids, or null when no filter is active.
            this.x2mMatchedIds = null;
            this.x2mSearchOffset = 0;
            this.x2mPageSize = (this.value && this.value.limit) || DEFAULT_PAGE_SIZE;
        },

        /**
         * @override
         */
        start: function () {
            var self = this;
            return Promise.resolve(this._super.apply(this, arguments)).then(
                function () {
                    if (!self._isX2mSearchEnabled()) {
                        return Promise.resolve();
                    }
                    return self._setupX2mSearch();
                }
            );
        },

        /**
         * @override
         */
        destroy: function () {
            if (this.x2mSearchModel) {
                this.x2mSearchModel.off("search", this);
                this.x2mSearchModel = null;
            }
            this._super.apply(this, arguments);
        },

        /**
         * Data entry must not be disturbed by an active filter, so this override
         * mirrors the three paths of the core implementation instead of forcing a
         * re-render and a new query on every single change:
         *
         * - a cell of a row is being edited: the core keeps that row in edition and
         *   only refreshes the other rows through confirmUpdate(). We do the same,
         *   but on the filtered list, so neither the focus nor the filter is lost.
         * - a row was added or removed: the datapoint keeps every row loaded, the
         *   matching ids are still valid, so a plain re-render is enough. No RPC.
         * - the datapoint was reloaded from the server (typically after a save): it
         *   has a limit again, and the matching rows must be recomputed.
         *
         * @override
         */
        reset: function (record, ev) {
            var self = this;
            if (!this._isX2mSearchActive()) {
                return this._super.apply(this, arguments);
            }
            if (this.record && record && this.record.res_id !== record.res_id) {
                return Promise.resolve(this._super.apply(this, arguments)).then(
                    function () {
                        return self._clearX2mSearch();
                    }
                );
            }
            if (
                ev &&
                ev.target === this &&
                ev.data.changes &&
                this.view.arch.tag === "tree"
            ) {
                var command = ev.data.changes[this.name];
                if (command && command.operation === "UPDATE" && command.data) {
                    this._reset(record, ev);
                    var state = this._getX2mFilteredValue(this.value);
                    return this.renderer.confirmUpdate(
                        state,
                        command.id,
                        state.getFieldNames({viewType: "list"}),
                        ev.initialEvent
                    );
                }
            }
            return Promise.resolve(this._super.apply(this, arguments)).then(
                function () {
                    if (self._isX2mSearchActive() && self.value.limit !== 0) {
                        return self._applyX2mSearch(self._getX2mSearchDomain());
                    }
                    return Promise.resolve();
                }
            );
        },

        // ---------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------

        /**
         * @private
         * @returns {Boolean} whether this field may show a search bar
         */
        _isX2mSearchEnabled: function () {
            var options = this.nodeOptions || {};
            if (
                Object.prototype.hasOwnProperty.call(options, "x2m_search") &&
                !options.x2m_search
            ) {
                return false;
            }
            var widget = this.attrs && this.attrs.widget;
            if (widget && STANDARD_WIDGETS.indexOf(widget) === -1) {
                return false;
            }
            if (!this.view || !this.view.arch || this.view.arch.tag !== "tree") {
                return false;
            }
            return Boolean(this.renderer && this.renderer.columns);
        },

        /**
         * @private
         * @returns {Boolean} whether a filter is currently applied
         */
        _isX2mSearchActive: function () {
            return Boolean(this.x2mMatchedIds) && this._isX2mSearchEnabled();
        },

        /**
         * Columns of the embedded list, which are the only fields the user is
         * offered to search on. Keeping the searchable fields in sync with the
         * displayed columns also guarantees they are loaded client side.
         *
         * @private
         * @returns {String[]}
         */
        _getX2mSearchableFields: function () {
            var fields = this.view.fields;
            var result = [];
            var children = this.view.arch.children || [];
            for (var i = 0; i < children.length; i++) {
                var node = children[i];
                if (node.tag !== "field" || !node.attrs || !node.attrs.name) {
                    continue;
                }
                var name = node.attrs.name;
                var field = fields[name];
                if (!field || UNSEARCHABLE_TYPES.indexOf(field.type) !== -1) {
                    continue;
                }
                var modifiers = node.attrs.modifiers || {};
                if (typeof modifiers === "string") {
                    try {
                        modifiers = JSON.parse(modifiers);
                    } catch (_error) {
                        modifiers = {};
                    }
                }
                if (
                    modifiers.column_invisible === true ||
                    modifiers.invisible === true
                ) {
                    continue;
                }
                if (result.indexOf(name) === -1) {
                    result.push(name);
                }
            }
            return result;
        },

        /**
         * Builds a search model for this field only, out of a synthetic search arch
         * listing the columns of the embedded list. Everything else (facets,
         * autocompletion, domain generation) is the stock Odoo search machinery.
         *
         * @private
         * @returns {Promise}
         */
        _buildX2mSearchModel: function () {
            var searchableFields = this._getX2mSearchableFields();
            if (!searchableFields.length) {
                return Promise.resolve(null);
            }
            var fieldNodes = searchableFields.map(function (name) {
                return '<field name="' + name + '"/>';
            });
            var arch = "<search>" + fieldNodes.join("") + "</search>";
            var archInfo = ActionModel.extractArchInfo({search: arch});
            var controlPanelInfo = archInfo[ControlPanel.modelExtension];

            var extensions = {};
            extensions[ControlPanel.modelExtension] = {
                activateDefaultFavorite: false,
                archNodes: controlPanelInfo.children,
                withSearchBar: true,
            };

            var searchModel = new ActionModel(extensions, {
                env: owl.Component.env,
                modelName: this.field.relation,
                context: this.record.getContext(this.recordParams),
                domain: [],
                searchMenuTypes: [],
                fields: this.view.fields,
            });
            return searchModel.load().then(function () {
                return searchModel.isReady().then(function () {
                    return searchModel;
                });
            });
        },

        /**
         * Swaps the control panel mounted by the framework for the one embedding
         * the search bar.
         *
         * @private
         * @returns {Promise}
         */
        _setupX2mSearch: function () {
            var self = this;
            return this._buildX2mSearchModel().then(function (searchModel) {
                if (!searchModel || self.isDestroyed()) {
                    return Promise.resolve();
                }
                self.x2mSearchModel = searchModel;
                searchModel.on("search", self, self._onX2mSearch);
                if (self._controlPanelWrapper) {
                    self._controlPanelWrapper.destroy();
                }
                self._controlPanelWrapper = new ComponentWrapper(
                    self,
                    ControlPanelX2ManySearch,
                    self._getX2mControlPanelProps()
                );
                return self._controlPanelWrapper.mount(self.el, {
                    position: "first-child",
                });
            });
        },

        /**
         * @private
         * @param {Object} [pagingState] paging values overriding the current ones
         * @returns {Object} props of the x2many control panel
         */
        _getX2mControlPanelProps: function (pagingState) {
            // Called on purpose, exactly like the core _updateControlPanel does:
            // other modules (muk_web_theme) include _renderButtons to restyle the
            // buttons, and they must keep being called.
            this._renderButtons();
            var pagerProps = Object.assign(this.pagingState, pagingState || {}, {
                limit: Math.max(this.value.limit, this.value.data.length),
            });
            return {
                cp_content: {$buttons: this.$buttons},
                pager: pagerProps,
                fields: this.view.fields,
                searchModel: this.x2mSearchModel,
                withSearchBar: true,
            };
        },

        /**
         * The domain currently built by the search bar.
         *
         * @private
         * @returns {Array}
         */
        _getX2mSearchDomain: function () {
            if (!this.x2mSearchModel) {
                return [];
            }
            return this.x2mSearchModel.get("query").domain || [];
        },

        /**
         * Loads every row of the x2many, through the regular loading mechanism of
         * the framework. A limit of 0 means "no limit" for a list datapoint.
         *
         * @private
         * @returns {Promise}
         */
        _loadAllX2mRows: function () {
            var self = this;
            return new Promise(function (resolve) {
                self.trigger_up("load", {
                    id: self.value.id,
                    limit: 0,
                    offset: 0,
                    on_success: function (value) {
                        self.value = value;
                        resolve();
                    },
                });
            });
        },

        /**
         * Asks the server which rows match the domain. The domain is evaluated by
         * Odoo itself, so the semantics are exactly the ones of any other view.
         *
         * @private
         * @param {Array} domain
         * @returns {Promise}
         */
        _applyX2mSearch: function (domain) {
            var self = this;
            if (!domain.length) {
                return this._clearX2mSearch();
            }
            return this._loadAllX2mRows().then(function () {
                var savedIds = self.value.res_ids.filter(function (resId) {
                    return typeof resId === "number" && resId > 0;
                });
                self.x2mSearchOffset = 0;
                if (!savedIds.length) {
                    self.x2mMatchedIds = new Set();
                    self.x2mSearchOffset = 0;
                    return self._render();
                }
                return rpc
                    .query({
                        model: self.field.relation,
                        method: "search",
                        args: [[["id", "in", savedIds]].concat(domain)],
                        kwargs: {
                            context: self.record.getContext(self.recordParams),
                        },
                    })
                    .then(function (matchedIds) {
                        self.x2mMatchedIds = new Set(matchedIds);
                        self.x2mSearchOffset = 0;
                        return self._render();
                    });
            });
        },

        /**
         * Drops the filter and restores the regular paging of the field.
         *
         * @private
         * @returns {Promise}
         */
        _clearX2mSearch: function () {
            var self = this;
            if (!this.x2mMatchedIds) {
                return Promise.resolve();
            }
            this.x2mMatchedIds = null;
            this.x2mSearchOffset = 0;
            return new Promise(function (resolve) {
                self.trigger_up("load", {
                    id: self.value.id,
                    limit: self.x2mPageSize,
                    offset: 0,
                    on_success: function (value) {
                        self.value = value;
                        self.pagingState.currentMinimum = 1;
                        self.pagingState.limit = value.limit;
                        self.pagingState.size = value.count;
                        resolve(self._render());
                    },
                });
            });
        },

        /**
         * A copy of the list datapoint holding the matching rows only. The original
         * value object is left untouched, and so is the datapoint of the model.
         *
         * @private
         * @param {Object} value
         * @returns {Object}
         */
        _getX2mFilteredValue: function (value) {
            var matchedIds = this.x2mMatchedIds;
            var rows = value.data.filter(function (record) {
                // Rows that are not saved yet are always kept visible, otherwise a
                // line added while a filter is active would immediately disappear.
                if (isNewRow(record)) {
                    return true;
                }
                return matchedIds.has(record.res_id);
            });
            if (this.x2mSearchOffset >= rows.length) {
                this.x2mSearchOffset = 0;
            }
            var page = rows.slice(
                this.x2mSearchOffset,
                this.x2mSearchOffset + this.x2mPageSize
            );
            // Rows that are not saved yet are displayed in addition to the rows of
            // the current page, exactly like BasicModel._setDataInRange does. A line
            // added while the filter is active is appended at the end of the list,
            // and would otherwise be left out of the page the user is looking at.
            rows.forEach(function (record) {
                if (isNewRow(record) && page.indexOf(record) === -1) {
                    page.push(record);
                }
            });
            return _.extend({}, value, {
                data: page,
                res_ids: page.map(function (record) {
                    return record.res_id;
                }),
                count: rows.length,
                offset: this.x2mSearchOffset,
                limit: this.x2mPageSize,
            });
        },

        /**
         * @override
         */
        _render: function () {
            var self = this;
            if (!this._isX2mSearchActive()) {
                return this._super.apply(this, arguments);
            }
            var originalValue = this.value;
            var restore = function () {
                self.value = originalValue;
            };
            this.value = this._getX2mFilteredValue(originalValue);
            this.pagingState.currentMinimum = this.x2mSearchOffset + 1;
            var rendering = null;
            try {
                rendering = this._super.apply(this, arguments);
            } catch (error) {
                restore();
                throw error;
            }
            return Promise.resolve(rendering).then(restore, function (error) {
                restore();
                return Promise.reject(error);
            });
        },

        /**
         * ComponentWrapper.update() replaces the props instead of merging them, so
         * the core implementation would drop the search props. The body below is
         * the core one, plus the search props.
         *
         * @override
         */
        _updateControlPanel: function (pagingState) {
            if (!this.x2mSearchModel || !this._controlPanelWrapper) {
                return this._super.apply(this, arguments);
            }
            return this._controlPanelWrapper.update(
                this._getX2mControlPanelProps(pagingState)
            );
        },

        /**
         * While a filter is active every row is already loaded, and paging is done
         * client side over the matching rows. Reloading through the model here
         * would restore a limit and break that invariant.
         *
         * @override
         */
        _onPagerChanged: function (ev) {
            if (!this._isX2mSearchActive()) {
                return this._super.apply(this, arguments);
            }
            ev.stopPropagation();
            this.x2mSearchOffset = ev.data.currentMinimum - 1;
            return this._render();
        },

        /**
         * @private
         * @param {Object} query
         */
        _onX2mSearch: function () {
            this._applyX2mSearch(this._getX2mSearchDomain());
        },
    };

    relationalFields.FieldOne2Many.include(X2mSearchMixin);
    relationalFields.FieldMany2Many.include(X2mSearchMixin);

    return X2mSearchMixin;
});
