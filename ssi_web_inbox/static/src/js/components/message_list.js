odoo.define("ssi_web_inbox.MessageList", function (require) {
    "use strict";

    const MessageList = require("mail/static/src/components/message_list/message_list.js");

    const InboxMessageRow = require("ssi_web_inbox.InboxMessageRow");

    /**
     * Make the inbox row reachable from the `mail.MessageList` template.
     *
     * OWL resolves a sub-component through `constructor.components` of the
     * component owning the template, so extending the template of
     * `MessageList` is not enough on its own: the class has to know the
     * component the added markup refers to.
     */
    Object.assign(MessageList.components, {InboxMessageRow});

    return MessageList;
});
