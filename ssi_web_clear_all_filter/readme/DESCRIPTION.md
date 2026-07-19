Adds a single button at the far right of the search bar that discards every
active facet in one click, ported from the 14.0 module of the same name.

The 14.0 implementation used `odoo.define`, a three-argument `patch()` on
the legacy OWL 1 `web.SearchBar` widget, and looped over
`model.get("facets")` calling `_onFacetRemove` once per facet. None of that
API exists in Odoo 19: this port patches `SearchBar`
(`@web/search/search_bar/search_bar`, template `web.SearchBar`) with the
two-argument `patch()`, and clears every facet — filter, field, favorite
**and** group by — in a single call to `env.searchModel.clearQuery()`
instead of removing them one by one.

The button is only rendered while at least one facet is active; without
any active facet the search bar looks exactly like standard Odoo.
