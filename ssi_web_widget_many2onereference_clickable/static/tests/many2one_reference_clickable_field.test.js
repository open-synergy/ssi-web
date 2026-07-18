/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    defineModels,
    fields,
    mockService,
    models,
    mountView,
    onRpc,
} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";
import {animationFrame} from "@odoo/hoot-mock";
import {click} from "@odoo/hoot-dom";

class Partner extends models.Model {
    name = fields.Char();
    reference = fields.Reference({
        selection: [
            ["product", "Product"],
            ["partner", "Partner"],
        ],
    });
    ref_model = fields.Char({string: "Resource Model"});
    ref_res_id = fields.Many2oneReference({
        string: "Resource Id",
        model_field: "ref_model",
        relation: "product",
    });

    _records = [
        {id: 1, name: "first record", reference: "product,37", ref_res_id: false},
        {id: 2, name: "empty reference", reference: false, ref_res_id: false},
        {
            id: 3,
            name: "many2one_reference value",
            reference: false,
            ref_model: "product",
            ref_res_id: 37,
        },
    ];
}

class Product extends models.Model {
    name = fields.Char();

    _records = [{id: 37, name: "xphone"}];
}

defineModels([Partner, Product]);
onRpc("has_group", () => true);

test("reference field: readonly value renders as a clickable open link", async () => {
    mockService("action", {
        doAction(action) {
            expect.step(`doAction ${action.res_model} ${action.res_id}`);
        },
    });

    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: '<form edit="0"><field name="reference" widget="many2one_reference"/></form>',
    });

    const link = ".o_field_widget[name=reference] .o_form_uri";
    expect(link).toHaveCount(1);
    expect(link).toHaveText("xphone");

    await click(link);
    await animationFrame();
    expect.verifySteps(["doAction product 37"]);
});

test("reference field: empty value renders no open link", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 2,
        arch: '<form edit="0"><field name="reference" widget="many2one_reference"/></form>',
    });

    expect(".o_field_widget[name=reference] .o_form_uri").toHaveCount(0);
});

test("reference field: edit mode does not render the open link", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: '<form><field name="reference" widget="many2one_reference"/></form>',
    });

    expect(".o_field_widget[name=reference] .o_form_uri").toHaveCount(0);
    expect(".o_field_widget[name=reference] input").toHaveCount(1);
});

test("many2one_reference type field keeps its original (non-reference) rendering", async () => {
    await mountView({
        type: "form",
        resModel: "partner",
        resId: 3,
        arch:
            '<form edit="0"><field name="ref_model" invisible="1"/>' +
            '<field name="ref_res_id" widget="many2one_reference"/></form>',
    });

    const link = ".o_field_widget[name=ref_res_id] .o_form_uri";
    expect(link).toHaveCount(1);
    expect(link).toHaveText("xphone");
});
