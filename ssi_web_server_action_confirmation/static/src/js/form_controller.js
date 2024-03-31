odoo.define("ssi_web_server_action_confirmation.FormController", function (require) {
    "use strict";

    const Core = require("web.core");
    const FormController = require("web.FormController");
    const Dialog = require("web.Dialog");
    const _t = Core._t;

    return FormController.include({
        _onClickServerAction: async function () {
            Dialog.confirm(
                this,
                _t("Are you sure that you would like to perform this action?"),
                {
                    confirm_callback: () => this._onDuplicateRecord(),
                }
            );
        },
        _getActionMenuItems: function (state) {
            const props = this._super(...arguments);
            debugger;
            var i;
            if (props && props.items && props.items.action) {
                for (i=0; i<props.items.action.length; i++) {
                    debugger;
//                    props.items.action[i].callback = () =>
//                        this._onClickServerAction();
//                    }
                }
            }
            return props;
        },
        _onButtonClicked: function (ev) {
            const res = this._super(...arguments);
            debugger;
            return res;
        },
    });
});
