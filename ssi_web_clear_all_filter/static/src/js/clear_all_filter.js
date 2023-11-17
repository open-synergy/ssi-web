odoo.define("ssi_web_clear_all_filter/static/src/js/clear_all_filter.js", function (require) {
    "use strict";

    const {patch} = require("web.utils");
    const components = {
        SearchBar: require("web.SearchBar"),
    };

    patch(components.SearchBar, "ssi_web_clear_all_filter/static/src/js/clear_all_filter.js", {
        _doClearAllFilter(facets) {
            debugger;
            for (let i = 0; i < facets.length; i++) {
                this._onFacetRemove(facets[i]);
            }
        },
    });

});
