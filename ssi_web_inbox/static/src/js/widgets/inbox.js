odoo.define("ssi_web_inbox.InboxWidget", function (require) {
    "use strict";

    const DiscussWidget = require("mail/static/src/widgets/discuss/discuss.js");

    const {action_registry} = require("web.core");

    /**
     * Client action backing the Gmail like inbox.
     *
     * It extends the standard Discuss action instead of replacing it, so
     * the control panel, the search bar and the mailbox selection are
     * inherited as they are. What changes is rendered further down, in the
     * message list, and the action is registered under its own tag so that
     * `mail.widgets.discuss` keeps working for whoever still uses it.
     */
    const InboxWidget = DiscussWidget.extend({
        /**
         * Tag the root element of the action.
         *
         * The stylesheet of this module hangs on that class, so the inbox
         * look is confined to this action and cannot leak into another
         * screen embedding the same messaging components.
         *
         * @override {web.AbstractAction}
         * @returns {Promise}
         */
        async start() {
            await this._super(...arguments);
            this.el.classList.add("o_InboxAction");
        },
    });

    action_registry.add("ssi_web_inbox.inbox", InboxWidget);

    return InboxWidget;
});
