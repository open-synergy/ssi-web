odoo.define("ssi_web_server_action_confirmation.BasicController", function (require) {
    "use strict";

    const Core = require("web.core");
    const BasicController = require("web.BasicController");
    const Dialog = require("web.Dialog");
    const _t = Core._t;

    return BasicController.include({
        _callButtonAction: function (attrs, record) {
            const res = this._super.apply(this, arguments);
            debugger;
            return res;
        },
        async _executeButtonAction(actionData, recordData) {
            const res = this._super.apply(this, arguments);
            debugger;
            return res;
        },
    });
});
