/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {standardFieldProps} from "@web/views/fields/standard_field_props";

/**
 * WhatsApp Message field widget.
 *
 * Readonly mode : a single clickable WhatsApp icon button that opens
 *                 `https://wa.me/<digits>` in a new tab, where `<digits>`
 *                 is the field value with every non-digit character
 *                 stripped.
 * Edit mode     : nothing is rendered — editing is expected to happen via
 *                 the same field shown again without this widget (or with
 *                 another one).
 * Empty value   : nothing is rendered, in either mode.
 *
 * Ported from the 14.0 module of the same name. That version also
 * monkeypatched `BasicRenderer._renderFieldWidget` so a field shown twice
 * with a different `widget=` on each node would not collapse onto a
 * single cached Widget class. That patch is intentionally *not* ported:
 * Odoo 19's `Field` component (`@web/views/fields/field.js`,
 * `getFieldFromRegistry`) already resolves the widget class per
 * `<field>` node at render time, so the same field can be rendered more
 * than once with different widgets with zero extra code.
 *
 * Usage in XML view:
 *   <field name="mobile" widget="whatsapp_message"/>
 */
export class WhatsappMessageField extends Component {
    static template = "ssi_web_widget_whatsapp.WhatsappMessageField";
    static props = {
        ...standardFieldProps,
    };

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    get cleanedNumber() {
        return String(this.value).replace(/\D/g, "");
    }

    get whatsappUrl() {
        return `https://wa.me/${this.cleanedNumber}`;
    }

    get buttonLabel() {
        return _t("Send WhatsApp message");
    }
}

export const whatsappMessageField = {
    component: WhatsappMessageField,
    displayName: _t("WhatsApp Message"),
    supportedTypes: ["char"],
};

registry.category("fields").add("whatsapp_message", whatsappMessageField);
