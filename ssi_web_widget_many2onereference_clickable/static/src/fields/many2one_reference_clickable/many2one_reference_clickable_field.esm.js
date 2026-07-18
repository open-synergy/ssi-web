/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    Many2OneReferenceField,
    many2oneReferenceField,
} from "@web/views/fields/many2one_reference/many2one_reference_field";
import {Component} from "@odoo/owl";
import {ReferenceField} from "@web/views/fields/reference/reference_field";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";

/**
 * Odoo 19's own `Many2One` component (used internally by both
 * `ReferenceField` and `Many2OneReferenceField`) already renders the
 * value of a readonly relational field as a clickable link that opens
 * the related record — in form views *and* list views, since both go
 * through the same `<Field/>` resolution. See
 * `addons/web/static/src/views/fields/many2one/many2one.xml`,
 * `t-if="props.canOpen"` branch.
 *
 * This widget therefore does not draw its own "open" button; it exists
 * to keep the historical `many2one_reference` widget name (ported from
 * the v14 module of the same name) available as an explicit,
 * unambiguous choice for `reference` fields.
 *
 * `many2one_reference` is *also* the registry key Odoo core uses for its
 * own widget of the unrelated `many2one_reference` field type (an
 * integer foreign-key companion field, e.g. `mail.message.res_id`).
 * Reusing the same key without care would break every core field of
 * that type. This component type-dispatches at render time instead:
 * `reference`-type fields get `ReferenceField` (which already shows the
 * open link/button); any other type (i.e. genuine `many2one_reference`
 * fields) keeps rendering through the original, untouched
 * `Many2OneReferenceField` — zero behavior change for that type.
 */
export class Many2oneReferenceClickableField extends Component {
    static template =
        "ssi_web_widget_many2onereference_clickable.Many2oneReferenceClickableField";
    static components = {ReferenceField, Many2OneReferenceField};
    static props = {...Many2OneReferenceField.props};

    get isReferenceType() {
        return this.props.record.fields[this.props.name].type === "reference";
    }
}

export const many2oneReferenceClickableField = {
    ...many2oneReferenceField,
    component: Many2oneReferenceClickableField,
    displayName: _t("Many2one Reference Clickable"),
    supportedTypes: ["reference", "many2one_reference"],
};

registry
    .category("fields")
    .add("many2one_reference", many2oneReferenceClickableField, {force: true});
