/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {defineModels, fields, models, mountView} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";

class Partner extends models.Model {
    json_field = fields.Json();
    schema_char = fields.Char();

    _records = [{id: 1, json_field: false, schema_char: false}];
}

defineModels([Partner]);

test("readonly: renders the stored value as formatted JSON", async () => {
    Partner._records[0].json_field = {name: "Odoo", age: 18};
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="rjsf" readonly="1"/></form>',
    });

    expect(".o_field_rjsf .o_rjsf_readonly_json").toHaveCount(1);
    expect(".o_field_rjsf .o_rjsf_readonly_json").toHaveText(
        JSON.stringify({name: "Odoo", age: 18}, null, 2)
    );
    // No React tree should ever be mounted in readonly mode.
    expect(".o_field_rjsf .o_rjsf_form_container").toHaveCount(0);
});

test("readonly: empty value shows the (empty) placeholder", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="rjsf" readonly="1"/></form>',
    });

    expect(".o_field_rjsf .o_rjsf_readonly_json").toHaveText("(empty)");
});

test("edit: no schema and no schema_field shows the no-valid-schema message", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="rjsf"/></form>',
    });

    expect(".o_field_rjsf .o_rjsf_no_schema").toHaveCount(1);
    expect(".o_field_rjsf .o_rjsf_form_container").toHaveCount(0);
});

test("edit: static schema option mounts the RJSF form container", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch:
            '<form><field name="json_field" widget="rjsf" ' +
            "options=\"{'schema': {'type': 'object', " +
            "'properties': {'name': {'type': 'string'}}}}\"/></form>",
    });

    expect(".o_field_rjsf .o_rjsf_form_container").toHaveCount(1);
    expect(".o_field_rjsf .o_rjsf_no_schema").toHaveCount(0);
});

test("edit: schema_field option reads the schema from a sibling field", async () => {
    Partner._records[0].schema_char = JSON.stringify({
        type: "object",
        properties: {name: {type: "string"}},
    });
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch:
            '<form><field name="schema_char" invisible="1"/>' +
            '<field name="json_field" widget="rjsf" ' +
            "options=\"{'schema_field': 'schema_char'}\"/></form>",
    });

    expect(".o_field_rjsf .o_rjsf_form_container").toHaveCount(1);
    expect(".o_field_rjsf .o_rjsf_no_schema").toHaveCount(0);
});
