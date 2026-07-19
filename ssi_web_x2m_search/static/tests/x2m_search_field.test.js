/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";

class Line extends models.Model {
    name = fields.Char();

    _records = [
        {id: 1, name: "Apple"},
        {id: 2, name: "Banana"},
        {id: 3, name: "Cherry"},
    ];
}

class Partner extends models.Model {
    name = fields.Char();
    line_ids = fields.One2many({relation: "line"});

    _records = [{id: 1, name: "Record 1", line_ids: [1, 2, 3]}];
}

defineModels([Partner, Line]);

test("search box is displayed for widget=x2m_search", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids" widget="x2m_search"><list><field name="name"/></list></field></form>`,
    });
    expect(".o_x2m_search_input").toHaveCount(1);
    expect(".o_data_row").toHaveCount(3);
});

test("search box is not displayed without widget=x2m_search", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids"><list><field name="name"/></list></field></form>`,
    });
    expect(".o_x2m_search_input").toHaveCount(0);
});

test("typing a keyword hides non-matching rows", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids" widget="x2m_search"><list><field name="name"/></list></field></form>`,
    });
    await contains(".o_x2m_search_input").edit("an");
    // Only "Banana" contains "an"; "Apple" and "Cherry" do not.
    expect(".o_data_row:not(.o_x2m_search_hidden)").toHaveCount(1);
    expect(".o_data_row.o_x2m_search_hidden").toHaveCount(2);
});

test("clearing the search box restores every row", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids" widget="x2m_search"><list><field name="name"/></list></field></form>`,
    });
    await contains(".o_x2m_search_input").edit("an");
    await contains(".o_x2m_search_input").edit("");
    expect(".o_data_row:not(.o_x2m_search_hidden)").toHaveCount(3);
});

test("a keyword matching nothing hides every row without raising", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids" widget="x2m_search"><list><field name="name"/></list></field></form>`,
    });
    await contains(".o_x2m_search_input").edit("zzz-no-match");
    expect(".o_data_row:not(.o_x2m_search_hidden)").toHaveCount(0);
    // Search box remains usable (still present, still editable).
    expect(".o_x2m_search_input").toHaveCount(1);
});
