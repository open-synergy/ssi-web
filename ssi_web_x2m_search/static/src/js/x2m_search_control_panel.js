// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

odoo.define("ssi_web_x2m_search.ControlPanelX2ManySearch", function (require) {
    "use strict";

    var ControlPanelX2Many = require("web.ControlPanelX2Many");

    /**
     * Control panel of an x2many field, extended with the standard Odoo search bar.
     *
     * ControlPanel already declares SearchBar in its components and already puts
     * props.searchModel in the sub environment, so the only things needed here are
     * the extra props and a template that actually renders the SearchBar.
     */
    class ControlPanelX2ManySearch extends ControlPanelX2Many {}

    ControlPanelX2ManySearch.defaultProps = {
        fields: {},
        withSearchBar: true,
    };
    ControlPanelX2ManySearch.props = Object.assign({}, ControlPanelX2Many.props, {
        fields: Object,
        searchModel: Object,
        withSearchBar: Boolean,
    });
    ControlPanelX2ManySearch.template = "ssi_web_x2m_search.ControlPanelX2ManySearch";

    return ControlPanelX2ManySearch;
});
