/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

odoo.define("ssi_web_gantt.GanttController", function (require) {
    "use strict";

    const AbstractController = require("web.AbstractController");
    const core = require("web.core");
    const dialogs = require("web.view_dialogs");

    const qweb = core.qweb;

    const ZOOM_STEP = 1.25;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 4;

    const GanttController = AbstractController.extend({
        // A name of our own: "open_record" is already mapped by
        // AbstractController onto BasicController semantics, which this view
        // does not implement.
        custom_events: _.extend({}, AbstractController.prototype.custom_events, {
            ssiGanttOpenRecord: "_onOpenRecord",
        }),

        /**
         * @override
         */
        init: function (parent, model, renderer, params) {
            this._super.apply(this, arguments);
            this.scale = params.defaultScale;
            this.zoom = params.defaultZoom;
            this.scales = params.scales;
            this.scaleLabels = params.scaleLabels;
            this.openPopupAction = params.openPopupAction;
            this.actionContext = params.actionContext;
        },

        /**
         * @override
         */
        start: function () {
            this.renderer.scale = this.scale;
            this.renderer.zoom = this.zoom;
            return this._super.apply(this, arguments);
        },

        // --------------------------------------------------------------------
        // Public
        // --------------------------------------------------------------------

        /**
         * The control panel mounts these buttons outside of ``this.el``, so the
         * ``events`` map of the controller never sees a click on them. They are
         * bound here, explicitly, on the buttons themselves.
         *
         * @override
         * @param {jQuery} [$node]
         */
        renderButtons: function ($node) {
            this.$buttons = $(qweb.render("ssi_web_gantt.Buttons", {widget: this}));
            this.$buttons.on(
                "click",
                ".o_ssi_gantt_button_today",
                this._onTodayClicked.bind(this)
            );
            this.$buttons.on(
                "click",
                ".o_ssi_gantt_button_scale",
                this._onScaleClicked.bind(this)
            );
            this.$buttons.on("click", ".o_ssi_gantt_button_zoom_in", () =>
                this._zoomBy(ZOOM_STEP)
            );
            this.$buttons.on("click", ".o_ssi_gantt_button_zoom_out", () =>
                this._zoomBy(1 / ZOOM_STEP)
            );
            if ($node) {
                this.$buttons.appendTo($node);
            }
        },

        /**
         * @override
         */
        exportState: function () {
            const state = this._super.apply(this, arguments);
            return _.extend({}, state, {scale: this.scale, zoom: this.zoom});
        },

        /**
         * @override
         */
        importState: function (state) {
            this._super.apply(this, arguments);
            if (state.scale) {
                this.scale = state.scale;
            }
            if (state.zoom) {
                this.zoom = state.zoom;
            }
        },

        // --------------------------------------------------------------------
        // Private
        // --------------------------------------------------------------------

        /**
         * Changing the scale or the zoom is a pure re-layout of the records
         * already in memory: no round trip to the server.
         *
         * @private
         * @returns {Promise}
         */
        _applyScale: function () {
            this.$buttons.find(".o_ssi_gantt_button_scale").each((index, element) => {
                const $button = $(element);
                $button.toggleClass("active", $button.data("scale") === this.scale);
            });
            return this.renderer.updateScale(this.scale, this.zoom);
        },

        /**
         * @private
         * @param {Number} factor
         * @returns {Promise}
         */
        _zoomBy: function (factor) {
            this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * factor));
            return this._applyScale();
        },

        /**
         * @private
         * @param {MouseEvent} event
         * @returns {Promise}
         */
        _onScaleClicked: function (event) {
            const scale = $(event.currentTarget).data("scale");
            if (!scale || scale === this.scale) {
                return Promise.resolve();
            }
            this.scale = scale;
            return this._applyScale();
        },

        /**
         * @private
         */
        _onTodayClicked: function () {
            this.renderer.scrollToToday();
        },

        /**
         * @private
         * @param {OdooEvent} event
         */
        _onOpenRecord: function (event) {
            event.stopPropagation();
            const resId = event.data.id;
            if (this.openPopupAction) {
                new dialogs.FormViewDialog(this, {
                    res_model: this.modelName,
                    res_id: resId,
                    context: this.actionContext,
                    view_id: Number(this.openPopupAction),
                    readonly: !this.model.rights.write,
                    on_saved: () => this.reload(),
                }).open();
                return;
            }
            this.trigger_up("switch_view", {
                view_type: "form",
                res_id: resId,
                mode: "readonly",
                model: this.modelName,
            });
        },
    });

    return GanttController;
});
