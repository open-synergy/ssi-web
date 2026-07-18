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

class Partner extends models.Model {
    csv_field = fields.Text();

    _records = [{id: 1, csv_field: false}];
}

defineModels([Partner]);

onRpc("has_group", () => true);

/**
 * @param {Number} rowCount - number of data rows (header excluded).
 * @returns {String} CSV text with a `name,active` header.
 */
function buildCsv(rowCount) {
    const lines = ["name,active"];
    for (let i = 1; i <= rowCount; i++) {
        lines.push(`row ${i},TRUE`);
    }
    return lines.join("\n");
}

test("readonly: first row is the header, data rows paginate 50 per page", async () => {
    Partner._records[0].csv_field = buildCsv(120);
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table" readonly="1"/></form>',
    });

    expect(".o_field_csv_table thead th:eq(1)").toHaveText("name");
    expect(".o_field_csv_table thead th:eq(2)").toHaveText("active");
    expect(".o_field_csv_table tbody tr").toHaveCount(50);
    expect(".o_field_csv_table .o_csv_table_page_info").toHaveText("1 / 3");

    await contains(".o_field_csv_table .o_csv_table_page_btn:eq(2)").click();
    expect(".o_field_csv_table .o_csv_table_page_info").toHaveText("2 / 3");
    expect(".o_field_csv_table tbody tr:eq(0) td:eq(1)").toHaveText("row 51");
});

test("readonly: a quoted cell containing a comma stays in a single column", async () => {
    Partner._records[0].csv_field = 'name,note\n"Doe, John","said ""hi"""';
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table" readonly="1"/></form>',
    });

    expect(".o_field_csv_table tbody tr").toHaveCount(1);
    expect(".o_field_csv_table tbody tr td:eq(1)").toHaveText("Doe, John");
    expect(".o_field_csv_table tbody tr td:eq(2)").toHaveText('said "hi"');
});

test("readonly: empty field renders an empty area without raising an error", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table" readonly="1"/></form>',
    });

    expect(".o_field_csv_table table").toHaveCount(0);
    expect(".o_field_csv_table .o_csv_table_toggle_bar").toHaveCount(0);
});

test("readonly: cells are not editable and no mode-toggle buttons are shown", async () => {
    Partner._records[0].csv_field = "name,qty\nfoo,1";
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table" readonly="1"/></form>',
    });

    expect(".o_field_csv_table .o_csv_table_toggle_bar").toHaveCount(0);
    expect(".o_field_csv_table .o_csv_table_textarea").toHaveCount(0);
    expect(".o_field_csv_table .o_csv_table_cell_input").toHaveCount(0);
    expect(".o_field_csv_table table").toHaveCount(1);
});

test("edit: toggling between table and text views keeps the value in sync", async () => {
    Partner._records[0].csv_field = "name,qty\nfoo,1\nbar,2";
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table"/></form>',
    });

    expect(".o_field_csv_table .o_csv_table_textarea").toHaveValue(
        "name,qty\nfoo,1\nbar,2"
    );

    await contains(
        ".o_field_csv_table .o_csv_table_toggle_btn:contains(Table)"
    ).click();
    expect(".o_field_csv_table table").toHaveCount(1);
    expect(".o_field_csv_table tbody tr").toHaveCount(2);
    expect(".o_field_csv_table .o_csv_table_cell_input:eq(0)").toHaveValue("foo");

    await contains(".o_field_csv_table .o_csv_table_toggle_btn:contains(Text)").click();
    expect(".o_field_csv_table .o_csv_table_textarea").toHaveValue(
        "name,qty\nfoo,1\nbar,2"
    );
});

test("edit: editing a table cell writes the change back as CSV", async () => {
    Partner._records[0].csv_field = "name,qty\nfoo,1\nbar,2";
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table"/></form>',
    });

    await contains(
        ".o_field_csv_table .o_csv_table_toggle_btn:contains(Table)"
    ).click();
    await contains(".o_field_csv_table .o_csv_table_cell_input:eq(0)").edit("baz", {
        confirm: true,
    });

    await contains(".o_field_csv_table .o_csv_table_toggle_btn:contains(Text)").click();
    expect(".o_field_csv_table .o_csv_table_textarea").toHaveValue(
        "name,qty\nbaz,1\nbar,2"
    );
});

test("edit: switching to table view on an empty value shows a message, not an error", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: '<form><field name="csv_field" widget="csv_table"/></form>',
    });

    await contains(
        ".o_field_csv_table .o_csv_table_toggle_btn:contains(Table)"
    ).click();
    expect(".o_field_csv_table table").toHaveCount(0);
    expect(".o_field_csv_table .o_csv_table_empty_msg").toHaveCount(1);
});
