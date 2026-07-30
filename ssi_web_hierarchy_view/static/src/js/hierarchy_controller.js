/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_hierarchy_view.HierarchyController", function (require) {
    "use strict";

    const AbstractController = require("web.AbstractController");
    const core = require("web.core");

    const qweb = core.qweb;
    const _t = core._t;

    const HierarchyController = AbstractController.extend({
        custom_events: _.extend({}, AbstractController.prototype.custom_events, {
            hierarchy_toggle_node: "_onToggleNode",
            hierarchy_open_record: "_onOpenRecord",
            pager_changed: "_onPagerChanged",
        }),

        /**
         * @override
         */
        renderButtons: function ($node) {
            this.$buttons = $(qweb.render("ssi_web_hierarchy_view.Buttons"));
            this.$buttons.on(
                "click",
                ".o_hierarchy_button_expand_all",
                this._onExpandAllClicked.bind(this)
            );
            this.$buttons.on(
                "click",
                ".o_hierarchy_button_collapse_all",
                this._onCollapseAllClicked.bind(this)
            );
            if ($node) {
                this.$buttons.appendTo($node);
            }
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * Only the root level is paginated: children loaded by expanding a
         * node are never counted or paged separately. Search mode has no
         * pager at all: what the server caps there is the number of
         * matches, through the view's ``limit``, not a page of roots.
         *
         * @override
         * @private
         */
        _getPagingInfo: function (state) {
            if (!state.rootCount || state.searchMode) {
                return null;
            }
            return {
                currentMinimum: state.offset + 1,
                limit: state.limit,
                size: state.rootCount,
            };
        },

        /**
         * @override
         * @private
         * @param {Object} state
         * @returns {Promise}
         */
        _update: function (state) {
            return this._super
                .apply(this, arguments)
                .then(() => this._warnIfSearchTruncated(state));
        },

        /**
         * Warns once, when a search stops showing every match because the
         * view's node limit was reached, and rearms the warning as soon as
         * a later search fits again.
         *
         * @private
         * @param {Object} state
         */
        _warnIfSearchTruncated: function (state) {
            if (!state || !state.searchTruncated) {
                this.searchTruncationWarned = false;
                return;
            }
            if (this.searchTruncationWarned) {
                return;
            }
            this.searchTruncationWarned = true;
            this._notifyNodeLimit();
        },

        /**
         * Tells the user that only part of the tree is on screen because
         * the view's ``limit`` was reached. Shared by Expand All and by
         * search mode, so both report the limit the same way.
         *
         * @private
         */
        _notifyNodeLimit: function () {
            this.displayNotification({
                type: "warning",
                title: _t("Hierarchy view"),
                message: _t(
                    "Only part of the tree was expanded: this " +
                        "view's node limit was reached."
                ),
            });
        },

        /**
         * Re-renders from the model's already-mutated in-memory state,
         * without asking it to reload from the server.
         *
         * @private
         * @returns {Promise}
         */
        _refresh: function () {
            return this.update({}, {reload: false});
        },

        // --------------------------------------------------------------------
        // Handlers
        // --------------------------------------------------------------------

        /**
         * @private
         * @param {OdooEvent} event
         */
        _onToggleNode: function (event) {
            event.stopPropagation();
            this.model.toggleNode(event.data.rowKey).then(() => this._refresh());
        },

        /**
         * Opens the clicked record in the model's own form view, the same
         * way clicking a row does in a standard list view.
         *
         * @private
         * @param {OdooEvent} event
         */
        _onOpenRecord: function (event) {
            event.stopPropagation();
            this.trigger_up("switch_view", {
                view_type: "form",
                res_id: event.data.id,
                mode: "readonly",
                model: this.modelName,
            });
        },

        /**
         * @private
         */
        _onExpandAllClicked: function () {
            this.model.expandAll().then((limitReached) => {
                if (limitReached) {
                    this._notifyNodeLimit();
                }
                return this._refresh();
            });
        },

        /**
         * @private
         */
        _onCollapseAllClicked: function () {
            this.model.collapseAll();
            this._refresh();
        },

        /**
         * @private
         * @param {OdooEvent} event
         */
        _onPagerChanged: function (event) {
            event.stopPropagation();
            const {currentMinimum, limit} = event.data;
            this.reload({offset: currentMinimum - 1, limit: limit});
        },
    });

    return HierarchyController;
});
