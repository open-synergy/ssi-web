odoo.define("ssi_web_inbox.Message", function (require) {
    "use strict";

    const {
        registerClassPatchModel,
        registerFieldPatchModel,
        registerInstancePatchModel,
    } = require("mail/static/src/model/model_core.js");
    const {attr} = require("mail/static/src/model/model_field.js");

    const patchName = "ssi_web_inbox/static/src/js/models/message.js";

    registerFieldPatchModel("mail.message", patchName, {
        /**
         * Whether the current partner has marked this message as read.
         * Mirrors the server side `inbox_read` field, and is independent
         * from `isNeedaction`: a read message stays in the Inbox mailbox.
         */
        isInboxRead: attr({
            default: false,
        }),
    });

    registerClassPatchModel("mail.message", patchName, {
        /**
         * Derive `isInboxRead` from the partner ids sent by the server,
         * the same way `isStarred` is derived from `starred_partner_ids`.
         *
         * @override
         */
        convertData(data) {
            const data2 = this._super(data);
            if ("inbox_read_partner_ids" in data) {
                data2.isInboxRead = data.inbox_read_partner_ids.includes(
                    this.env.messaging.currentPartner.id
                );
            }
            return data2;
        },
    });

    registerInstancePatchModel("mail.message", patchName, {
        /**
         * Mark this message as read for the current user.
         *
         * The local state is updated on return: there is no bus
         * notification, so other open tabs are not synchronized.
         */
        async setInboxRead() {
            await this.async(() =>
                this.env.services.rpc({
                    model: "mail.message",
                    method: "inbox_set_read",
                    args: [[this.id]],
                })
            );
            this.update({isInboxRead: true});
        },
        /**
         * Flip the read state of this message for the current user.
         *
         * The expected value is computed before the call so that the
         * local state matches what the server just did, without a
         * round trip to read it back.
         */
        async toggleInboxRead() {
            const isInboxRead = !this.isInboxRead;
            await this.async(() =>
                this.env.services.rpc({
                    model: "mail.message",
                    method: "inbox_toggle_read",
                    args: [[this.id]],
                })
            );
            this.update({isInboxRead});
        },
    });
});
