/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
    preloadBundle,
    preventResizeObserverError,
} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";

class Partner extends models.Model {
    _name = "res.partner";
    _rec_name = "display_name";

    foo = fields.Text({default: "My little Foo Value"});

    _records = [{id: 1, foo: "yop"}];
}

defineModels([Partner]);

preloadBundle("web.ace_lib");
preventResizeObserverError();

test("Fetch from GitHub button is displayed in edit mode", async () => {
    await mountView({
        resModel: "res.partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="foo" widget="code"/></form>`,
    });
    expect(".o_ace_git_fetch_btn").toHaveCount(1);
});

test("Fetch from GitHub button is hidden when the field is readonly", async () => {
    await mountView({
        resModel: "res.partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="foo" widget="code" readonly="1"/></form>`,
    });
    expect(".o_ace_git_fetch_btn").toHaveCount(0);
});

test("Clicking the button opens the Fetch from GitHub dialog", async () => {
    await mountView({
        resModel: "res.partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="foo" widget="code"/></form>`,
    });

    await contains(".o_ace_git_fetch_btn").click();

    expect(".modal .o_ace_git_dialog_form").toHaveCount(1);
    expect(".modal input#ace_git_url").toHaveCount(1);
    expect(".modal input#ace_git_token").toHaveCount(1);
});

test("Cancel closes the dialog without changing the field", async () => {
    await mountView({
        resModel: "res.partner",
        resId: 1,
        type: "form",
        arch: `<form><field name="foo" widget="code"/></form>`,
    });

    await contains(".o_ace_git_fetch_btn").click();
    expect(".modal").toHaveCount(1);

    await contains(".modal .btn-secondary").click();
    expect(".modal").toHaveCount(0);
    expect(".o_field_code").toHaveText(/yop/);
});
