odoo.define("ssi_web_server_action_confirmation.ActionMenus", function (require) {
    "use strict";

    const Core = require("web.core");
    const ActionMenus = require("web.ActionMenus");
    const Dialog = require("web.Dialog");
    const _t = Core._t;

    ActionMenus.ActionMenus.include({
        async _setActionItems(props) {
            const res = this._super(...arguments);
            debugger;
            return res;
        },
        async _executeAction(action) {
            const res = this._super(...arguments);
            debugger;
            return res;
        },
    });
    return ActionMenus;
});
