// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Nigeria
// License AGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

odoo.define("ssi_web_widget_whatsapp.WhatsAppWidget", function (require) {
    "use strict";

    var AbstractField = require("web.AbstractField");
    var fieldRegistry = require("web.field_registry");
    var core = require("web.core");
    var _t = core._t;
    var BasicRenderer = require("web.BasicRenderer");

    // ----------------------------------------------------------------
    // Patch BasicRenderer._renderFieldWidget so that when the same field
    // appears more than once in a form view with different widget=""
    // attributes, each occurrence gets the correct Widget class from the
    // node's widget attribute rather than always using the last-registered
    // Widget stored in fieldsInfo (which overwrites earlier definitions).
    // ----------------------------------------------------------------
    BasicRenderer.include({
        _renderFieldWidget: function (node, record, options) {
            var widgetName = node.attrs && node.attrs.widget;
            if (widgetName) {
                var fieldName = node.attrs.name;
                var viewType = (options && options.viewType) || this.viewType;
                var fieldInfo = record.fieldsInfo[viewType][fieldName];
                if (fieldInfo && fieldInfo.Widget) {
                    var correctWidget = fieldRegistry.getAny([widgetName]);
                    if (correctWidget && correctWidget !== fieldInfo.Widget) {
                        // Temporarily swap Widget so _super uses the right one.
                        var originalWidget = fieldInfo.Widget;
                        fieldInfo.Widget = correctWidget;
                        var result = this._super.apply(this, arguments);
                        fieldInfo.Widget = originalWidget;
                        return result;
                    }
                }
            }
            return this._super.apply(this, arguments);
        },
    });

    /**
     * WhatsApp Message Widget
     *
     * Extends AbstractField to render:
     *   - readonly mode : a single WhatsApp icon button that opens
     *                     https://wa.me/<number> in a new tab.
     *   - edit mode     : a standard text/tel input so the number can be edited.
     *
     * Usage in a view:
     *   <field name="mobile" widget="whatsapp_message"/>
     */
    var WhatsAppWidget = AbstractField.extend({
        className: "o_field_whatsapp",
        supportedFieldTypes: ["char"],

        // ----------------------------------------------------------------
        // Private helpers
        // ----------------------------------------------------------------

        _cleanPhoneNumber: function (phone) {
            if (!phone) {
                return "";
            }
            return String(phone).replace(/[^\d]/g, "");
        },

        // ----------------------------------------------------------------
        // Rendering — use _renderReadonly / _renderEdit (Odoo 14 pattern).
        // Overriding _render directly is not allowed; AbstractField calls
        // _renderReadonly or _renderEdit after _render runs and would
        // overwrite any content set inside a custom _render override.
        // ----------------------------------------------------------------

        // VIEW MODE: show only the WhatsApp icon button.
        _renderReadonly: function () {
            this.$el.empty();

            var value = this.value;
            if (!value) {
                return;
            }

            var cleanedNumber = this._cleanPhoneNumber(value);
            var waUrl = "https://wa.me/" + cleanedNumber;

            var $button = $("<a/>", {
                href: waUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                class: "o_whatsapp_btn",
                title: _t("Kirim pesan WhatsApp"),
                "aria-label": _t("Kirim pesan WhatsApp"),
            });

            var $icon = $("<i/>", {
                class: "fa fa-whatsapp o_whatsapp_icon",
                "aria-hidden": "true",
            });

            $button.append($icon);
            this.$el.append($button);
        },

        // EDIT MODE: hide — editing is done via the phone widget field.
        _renderEdit: function () {
            this.$el.empty();
        },

        // ----------------------------------------------------------------
        // Public API
        // ----------------------------------------------------------------

        isValid: function () {
            return true;
        },
    });

    fieldRegistry.add("whatsapp_message", WhatsAppWidget);

    return WhatsAppWidget;
});
