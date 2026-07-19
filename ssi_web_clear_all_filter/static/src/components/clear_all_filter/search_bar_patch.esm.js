/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {SearchBar} from "@web/search/search_bar/search_bar";
import {patch} from "@web/core/utils/patch";

/**
 * Adds a single button at the end of the search bar that discards every
 * active facet (filter/field/favorite facets *and* group by) in one click.
 *
 * Ported from the 14.0 module of the same name, which patched the legacy
 * OWL 1 `web.SearchBar` widget with a three-argument `patch()` and called
 * `_onFacetRemove` once per facet returned by `model.get("facets")`. None
 * of that API exists in Odoo 19: the equivalent component is `SearchBar`
 * (`@web/search/search_bar/search_bar`, template `web.SearchBar`), and the
 * source of truth for active facets is `env.searchModel`
 * (`addons/web/static/src/search/search_model.js`).
 *
 * `searchModel.facets` and `searchModel.groupBy` are both derived from
 * `searchModel.query`, so a single call to `searchModel.clearQuery()`
 * (which empties `query`) discards every facet in one operation, including
 * group by facets — there is no need to loop and remove facets one by one
 * as the 14.0 implementation did.
 */
patch(SearchBar.prototype, {
    /**
     * @returns {Boolean}
     */
    get hasActiveFacets() {
        return this.env.searchModel.facets.length > 0;
    },

    onClickClearAllFilter() {
        this.env.searchModel.clearQuery();
    },
});
