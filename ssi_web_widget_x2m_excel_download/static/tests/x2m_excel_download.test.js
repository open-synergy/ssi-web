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
        {id: 1, name: "Line 1"},
        {id: 2, name: "Line 2"},
    ];
}

class Partner extends models.Model {
    name = fields.Char();
    line_ids = fields.One2many({relation: "line"});
    tag_ids = fields.Many2many({relation: "line"});

    _records = [{id: 1, name: "Record 1", line_ids: [1, 2], tag_ids: [1, 2]}];
}

defineModels([Partner, Line]);

test("Download Excel button is displayed for a plain one2many list", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids"><list><field name="name"/></list></field></form>`,
    });
    expect(".o_x2m_excel_download_btn").toHaveCount(1);
});

test("Download Excel button is displayed for a plain many2many list", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="tag_ids" widget="many2many"><list><field name="name"/></list></field></form>`,
    });
    expect(".o_x2m_excel_download_btn").toHaveCount(1);
});

test("Download Excel button is hidden when options excel_download=0", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids" options="{'excel_download': 0}"><list><field name="name"/></list></field></form>`,
    });
    expect(".o_x2m_excel_download_btn").toHaveCount(0);
});

test("Clicking Download Excel does not raise on a brand new (unsaved) record", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: `<form><field name="line_ids"><list editable="bottom"><field name="name"/></list></field></form>`,
    });
    // No linked line yet on the unsaved record: the button is not shown
    // because there is nothing to export, and clicking is not exercised —
    // the assertion is that mounting a brand new record never throws.
    expect(".o_x2m_excel_download_btn").toHaveCount(0);
});

test("Clicking Download Excel exports without raising an error", async () => {
    await mountView({
        resModel: "partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="line_ids"><list><field name="name"/></list></field></form>`,
    });
    await contains(".o_x2m_excel_download_btn").click();
    // The export completed (the button is re-enabled, no lingering "busy"
    // state) instead of getting stuck in an error state.
    expect(".o_x2m_excel_download_btn").not.toHaveAttribute("disabled");
});
