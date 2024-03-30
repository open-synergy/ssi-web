odoo.define("ssi_web_server_action_confirmation.web_server_action_confirmation", function (require) {
    "use strict";

    const Core = require("web.core");
    const FormController = require("web.FormController");
    const Dialog = require("web.Dialog");
    const _t = Core._t;

    return FormController.include({
        /**
         * Trigger the confirmation dialog when duplicating records
         * @returns {Promise<void>}
         * @private
         */
        _onDuplicateRecordConfirm: async function () {
            Dialog.confirm(
                this,
                _t("Are you sure that you would like to copy this record?"),
                {
                    confirm_callback: () => this._onDuplicateRecord(),
                }
            );
        },
        /**
         * Override the "duplicate" in the action menu
         * @returns {any}
         * @private
         */
        _getActionMenuItems: function () {
            const props = this._super(...arguments);

            if (props && props.items && props.items.other) {
                const other_list = props.items.other;
                const duplicate_index = other_list.findIndex(
                    (item) => item.description === _t("Duplicate")
                );
                if (other_list[duplicate_index]) {
                    other_list[duplicate_index].callback = () =>
                        this._onDuplicateRecordConfirm();
                }
            }

            return props;
        },
    });
});
