/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {expect, test} from "@odoo/hoot";
import {
    contains,
    defineModels,
    fields,
    getFacetTexts,
    models,
    mountWithSearch,
    toggleMenuItem,
    toggleSearchBarMenu,
} from "@web/../tests/web_test_helpers";
import {SearchBar} from "@web/search/search_bar/search_bar";

class Partner extends models.Model {
    name = fields.Char();
    bool = fields.Boolean();

    _records = [
        {id: 1, name: "First record", bool: true},
        {id: 2, name: "Second record", bool: false},
    ];
    _views = {
        search: `
            <search>
                <field name="name"/>
                <filter string="Bool" name="bool_filter" domain="[('bool', '=', True)]"/>
                <filter string="Name" name="name_group_by" context="{'group_by': 'name'}"/>
            </search>
        `,
    };
}

defineModels([Partner]);

test.tags("desktop");
test("clear-all button is not rendered without any active facet", async () => {
    await mountWithSearch(SearchBar, {
        resModel: "partner",
        searchMenuTypes: ["filter", "groupBy"],
        searchViewId: false,
    });

    expect(`.o_searchview_facet`).toHaveCount(0);
    expect(`.o_clear_all_filter`).toHaveCount(0);
});

test.tags("desktop");
test("clicking clear-all removes every active facet, including group by", async () => {
    await mountWithSearch(SearchBar, {
        resModel: "partner",
        searchMenuTypes: ["filter", "groupBy"],
        searchViewId: false,
        context: {
            search_default_bool_filter: 1,
        },
    });
    await toggleSearchBarMenu();
    await toggleMenuItem("Name");

    expect(getFacetTexts()).toEqual(["Bool", "Name"]);
    expect(`.o_clear_all_filter`).toHaveCount(1);

    await contains(`.o_clear_all_filter`).click();

    expect(`.o_searchview_facet`).toHaveCount(0);
    expect(`.o_clear_all_filter`).toHaveCount(0);
});

test.tags("desktop");
test("clear-all button reappears once a new filter is applied", async () => {
    await mountWithSearch(SearchBar, {
        resModel: "partner",
        searchMenuTypes: ["filter"],
        searchViewId: false,
        context: {
            search_default_bool_filter: 1,
        },
    });
    expect(`.o_clear_all_filter`).toHaveCount(1);

    await contains(`.o_clear_all_filter`).click();
    expect(`.o_searchview_facet`).toHaveCount(0);
    expect(`.o_clear_all_filter`).toHaveCount(0);

    await toggleSearchBarMenu();
    await toggleMenuItem("Bool");

    expect(getFacetTexts()).toEqual(["Bool"]);
    expect(`.o_clear_all_filter`).toHaveCount(1);
});
