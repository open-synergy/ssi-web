odoo.define("ssi_web_server_action_confirmation.ActionManager", function (require) {
    "use strict";

    const Core = require("web.core");
    const ActionManager = require("web.ActionManager");
    const Dialog = require("web.Dialog");
    const _t = Core._t;

    return ActionManager.include({
        _onClickServerAction: async function (action, options) {
            Dialog.confirm(
                this,
                _t(
                    "Are you sure that you would like to perform this action (" +
                        action.name +
                        ")?"
                ),
                {
                    confirm_callback: () => this._executeServerAction(action, options),
                }
            );
        },
        _handleAction: function (action, options) {
            if (action.type === "ir.actions.server") {
                return this._onClickServerAction(action, options);
            }
            return this._super.apply(this, arguments);
        },
    });
});
