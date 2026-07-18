/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";
import {press} from "@odoo/hoot-dom";

class Partner extends models.Model {
    json_field = fields.Text();

    _records = [{id: 1, json_field: false}];
}

defineModels([Partner]);

onRpc("has_group", () => true);

test("readonly: renders a collapsible tree for a valid nested JSON value", async () => {
    Partner._records[0].json_field = JSON.stringify({
        name: "Odoo",
        active: true,
        tags: ["a", "b"],
        meta: {count: 2},
    });
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="json_viewer"/></form>',
    });

    expect(".o_field_json_viewer .o_json_viewer_container").toHaveCount(1);
    expect(".o_field_json_viewer .o_json_key:contains(name)").toHaveCount(1);
    expect(".o_field_json_viewer .o_json_value_string:contains('Odoo')").toHaveCount(1);
    expect(".o_field_json_viewer .o_json_value_boolean:contains(true)").toHaveCount(1);

    // "meta" is a nested object: expanded by default, one toggle available.
    expect(".o_field_json_viewer .o_json_toggle.fa-caret-down").toHaveCount(2);
    await contains(".o_field_json_viewer .o_json_toggle:eq(0)").click();
    expect(".o_field_json_viewer .o_json_toggle.fa-caret-right").toHaveCount(1);
    expect(".o_field_json_viewer .o_json_children").toHaveCount(1);
});

test("readonly: empty object/array shows a compact placeholder, not an error", async () => {
    Partner._records[0].json_field = JSON.stringify({list: [], obj: {}});
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="json_viewer"/></form>',
    });

    expect(".o_field_json_viewer .o_json_empty_obj:contains([])").toHaveCount(1);
    expect(".o_field_json_viewer .o_json_empty_obj:contains({})").toHaveCount(1);
});

test("readonly: invalid JSON is shown as raw text without raising an error", async () => {
    Partner._records[0].json_field = "not a json payload";
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="json_viewer"/></form>',
    });

    expect(".o_field_json_viewer .o_json_raw_text").toHaveText("not a json payload");
    expect(".o_field_json_viewer .o_json_viewer_container").toHaveCount(0);
});

test("readonly: empty value shows the (empty) placeholder", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="json_viewer"/></form>',
    });

    expect(".o_field_json_viewer .o_json_empty").toHaveText("(empty)");
});

test("edit: live valid/invalid indicator and Tab inserts indentation", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="json_field" widget="json_viewer"/></form>',
    });

    await contains(".o_field_json_viewer .o_json_editor").edit("{bad json", {
        confirm: false,
    });
    expect(".o_field_json_viewer .o_json_status.o_json_invalid").toHaveCount(1);

    await contains(".o_field_json_viewer .o_json_editor").edit('{"a": 1}', {
        confirm: false,
    });
    expect(".o_field_json_viewer .o_json_status.o_json_valid").toHaveCount(1);

    // Tab must insert 4 spaces at the caret instead of moving focus away.
    await contains(".o_field_json_viewer .o_json_editor").clear({confirm: false});
    await press("Tab");
    expect(".o_field_json_viewer .o_json_editor").toHaveValue("    ");
    expect(".o_field_json_viewer .o_json_editor").toBeFocused();
});
