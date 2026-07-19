/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {expect, test} from "@odoo/hoot";
import {
    contains,
    defineActions,
    defineModels,
    fields,
    getService,
    models,
    mountWithCleanup,
    onRpc,
} from "@web/../tests/web_test_helpers";
import {animationFrame} from "@odoo/hoot-mock";
import {WebClient} from "@web/webclient/webclient";

/**
 * The action service only knows an action's id when it is triggered from the
 * cog menu or a view button; resolving its `type` (to decide whether to ask
 * for confirmation) is done with a plain read on `ir.actions.actions`, the
 * base model shared by every concrete action type in real Odoo. It has no
 * dedicated mock model in `@web/../tests/web_test_helpers`, so tests define
 * one with the exact same ids used in `defineActions` below.
 */
class IrActionsActions extends models.Model {
    _name = "ir.actions.actions";

    name = fields.Char();
    type = fields.Char();

    _records = [
        {id: 2, name: "Archive Everything", type: "ir.actions.server"},
        {id: 3, name: "Partners", type: "ir.actions.act_window"},
    ];
}

class Partner extends models.Model {
    _records = [{id: 1, display_name: "First record"}];
    _views = {
        "kanban,1": `
            <kanban>
                <templates>
                    <t t-name="card">
                        <field name="display_name"/>
                    </t>
                </templates>
            </kanban>`,
    };
}

defineModels([IrActionsActions, Partner]);

test("running a server action asks for confirmation naming the action", async () => {
    defineActions([{id: 2, type: "ir.actions.server"}]);
    let serverActionRan = false;
    onRpc("/web/action/run", async () => {
        serverActionRan = true;
        return false;
    });

    await mountWithCleanup(WebClient);
    getService("action").doAction(2);
    await animationFrame();

    expect(".modal").toHaveCount(1);
    expect(".modal .modal-body").toHaveText(
        "Are you sure you want to run the action Archive Everything?"
    );
    expect(serverActionRan).toBe(false);

    await contains(".modal .btn-primary").click();
    await animationFrame();

    expect(serverActionRan).toBe(true);
});

test("declining the confirmation cancels the server action", async () => {
    defineActions([{id: 2, type: "ir.actions.server"}]);
    let serverActionRan = false;
    onRpc("/web/action/run", async () => {
        serverActionRan = true;
        return false;
    });

    await mountWithCleanup(WebClient);
    getService("action").doAction(2);
    await animationFrame();

    expect(".modal").toHaveCount(1);
    await contains(".modal .btn-secondary").click();
    await animationFrame();

    expect(".modal").toHaveCount(0);
    expect(serverActionRan).toBe(false);
});

test("actions other than ir.actions.server run without a confirmation dialog", async () => {
    defineActions([
        {
            id: 3,
            xml_id: "action_3",
            name: "Partners",
            res_model: "partner",
            views: [[1, "kanban"]],
        },
    ]);

    await mountWithCleanup(WebClient);
    await getService("action").doAction(3);

    expect(".modal").toHaveCount(0);
    expect(".o_kanban_view").toHaveCount(1);
});
