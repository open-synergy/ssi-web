/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";

class Partner extends models.Model {
    mobile = fields.Char();
    quantity = fields.Integer();

    _records = [
        {id: 1, mobile: "+62 812-3456-7890", quantity: 1},
        {id: 2, mobile: false, quantity: 1},
    ];
}

defineModels([Partner]);
onRpc("has_group", () => true);

test("readonly: non-empty value renders a link to wa.me with digits only", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: '<form><field name="mobile" widget="whatsapp_message" readonly="1"/></form>',
    });

    const link = ".o_field_widget[name=mobile] a.o_whatsapp_btn";
    expect(link).toHaveCount(1);
    expect(link).toHaveAttribute("href", "https://wa.me/6281234567890");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("readonly: empty value renders nothing", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 2,
        arch: '<form><field name="mobile" widget="whatsapp_message" readonly="1"/></form>',
    });

    expect(".o_field_widget[name=mobile] a.o_whatsapp_btn").toHaveCount(0);
});

test("edit mode: nothing is rendered even with a value", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: '<form><field name="mobile" widget="whatsapp_message"/></form>',
    });

    expect(".o_field_widget[name=mobile] a.o_whatsapp_btn").toHaveCount(0);
    expect(".o_field_widget[name=mobile] input").toHaveCount(0);
});

test("same field rendered twice with different widget= on one form", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: `<form>
            <field name="mobile"/>
            <field name="mobile" widget="whatsapp_message" readonly="1"/>
        </form>`,
    });

    // Plain occurrence: regular editable char input with the raw value.
    expect(".o_field_widget[name=mobile] input").toHaveCount(1);
    expect(".o_field_widget[name=mobile] input").toHaveValue("+62 812-3456-7890");

    // Widget occurrence: WhatsApp icon button, independent of the first.
    const link = ".o_field_widget[name=mobile] a.o_whatsapp_btn";
    expect(link).toHaveCount(1);
    expect(link).toHaveAttribute("href", "https://wa.me/6281234567890");
});

test("integer field: widget is rejected via supportedTypes, not silently broken", async () => {
    patchWithCleanup(console, {
        warn: (...args) => {
            expect.step(String(args[0]));
        },
    });

    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: '<form><field name="quantity" widget="whatsapp_message" readonly="1"/></form>',
    });

    expect.verifySteps(["The widget: whatsapp_message don't support the type integer"]);
});
