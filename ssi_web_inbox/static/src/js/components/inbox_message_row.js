odoo.define("ssi_web_inbox.InboxMessageRow", function (require) {
    "use strict";

    const components = {
        Composer: require("mail/static/src/components/composer/composer.js"),
        Message: require("mail/static/src/components/message/message.js"),
    };
    const useShouldUpdateBasedOnProps = require("mail/static/src/component_hooks/use_should_update_based_on_props/use_should_update_based_on_props.js");
    const useStore = require("mail/static/src/component_hooks/use_store/use_store.js");

    const {getMessagePreview} = require("ssi_web_inbox.message_preview");

    const {getLangDatetimeFormat} = require("web.time");

    const {Component, useState} = owl;

    /**
     * One scannable row of the Gmail like inbox.
     *
     * Closed, the row is a single line: author, record name, a plain text
     * preview of the body and the date. Opened, the very same row also
     * renders the full message through the core `Message` component, plus
     * the buttons needed to answer it. The open state is deliberately kept
     * local: it is a pure display concern, nothing on the server or in the
     * messaging models has to know which rows a user unfolded.
     */
    class InboxMessageRow extends Component {
        /**
         * @override
         */
        constructor(...args) {
            super(...args);
            this.state = useState({
                /**
                 * Whether the composer is shown under the open message.
                 */
                hasComposer: false,
                /**
                 * Whether the full message is shown under the summary.
                 */
                isOpen: false,
            });
            useShouldUpdateBasedOnProps();
            useStore((props) => {
                const message = this.env.models["mail.message"].get(
                    props.messageLocalId
                );
                const author = message ? message.author : undefined;
                const originThread = message ? message.originThread : undefined;
                const composer = originThread ? originThread.composer : undefined;
                return {
                    author,
                    authorNameOrDisplayName: author && author.nameOrDisplayName,
                    composer,
                    composerIsLog: composer && composer.isLog,
                    message: message ? message.__state : undefined,
                    originThread,
                    originThreadName: originThread && originThread.name,
                };
            });
        }

        // ----------------------------------------------------------------
        // Public
        // ----------------------------------------------------------------

        /**
         * Name shown as the sender of the row.
         *
         * Mirrors what the core message header does: the author when there
         * is one, the raw e-mail address for an incoming e-mail without a
         * matching partner, and a neutral label otherwise.
         *
         * @returns {String}
         */
        get authorName() {
            const message = this.message;
            if (!message) {
                return "";
            }
            if (message.author) {
                return message.author.nameOrDisplayName;
            }
            if (message.email_from) {
                return message.email_from;
            }
            return this.env._t("Anonymous");
        }

        /**
         * Composer of the thread the message originates from.
         *
         * Answering happens on the document the message belongs to, not on
         * the mailbox being browsed, so the composer is taken from the
         * origin thread. Mailbox only messages have none.
         *
         * @returns {mail.composer|undefined}
         */
        get composer() {
            const message = this.message;
            return message && message.originThread
                ? message.originThread.composer
                : undefined;
        }

        /**
         * Full date of the message, used as the title of the short date.
         *
         * @returns {String}
         */
        get datetime() {
            const message = this.message;
            return message && message.date
                ? message.date.format(getLangDatetimeFormat())
                : "";
        }

        /**
         * Record this component displays.
         *
         * @returns {mail.message|undefined}
         */
        get message() {
            return this.env.models["mail.message"].get(this.props.messageLocalId);
        }

        /**
         * One line plain text excerpt of the body.
         *
         * @returns {String}
         */
        get preview() {
            const message = this.message;
            return message ? getMessagePreview(message.body) : "";
        }

        /**
         * Name of the document the message is attached to.
         *
         * @returns {String}
         */
        get recordName() {
            const message = this.message;
            return message && message.originThread && message.originThread.name
                ? message.originThread.name
                : "";
        }

        /**
         * Label of the button flipping the read state.
         *
         * @returns {String}
         */
        get toggleReadTitle() {
            const message = this.message;
            return message && message.isInboxRead
                ? this.env._t("Mark as unread")
                : this.env._t("Mark as read");
        }

        // ----------------------------------------------------------------
        // Handlers
        // ----------------------------------------------------------------

        /**
         * Show the composer as a note on the origin thread.
         *
         * `isLog` drives the subtype the composer posts with, so it is set
         * before the composer is displayed rather than when the message is
         * sent.
         *
         * @private
         */
        _onClickLogNote() {
            const composer = this.composer;
            if (!composer) {
                return;
            }
            composer.update({isLog: true});
            this.state.hasComposer = true;
        }

        /**
         * Show the composer as a public message on the origin thread.
         *
         * @private
         */
        _onClickSendMessage() {
            const composer = this.composer;
            if (!composer) {
                return;
            }
            composer.update({isLog: false});
            this.state.hasComposer = true;
        }

        /**
         * Fold or unfold the row.
         *
         * Unfolding also marks the message as read, the way opening a mail
         * does in an e-mail client. Folding it back leaves the read state
         * alone: a message that has been read stays read.
         *
         * @private
         */
        _onClickSummary() {
            if (this.state.isOpen) {
                this.state.isOpen = false;
                this.state.hasComposer = false;
                return;
            }
            this.state.isOpen = true;
            const message = this.message;
            if (message && !message.isInboxRead) {
                message.setInboxRead();
            }
        }

        /**
         * Flip the read state of the message without opening it.
         *
         * @private
         */
        _onClickToggleRead() {
            const message = this.message;
            if (message) {
                message.toggleInboxRead();
            }
        }
    }

    Object.assign(InboxMessageRow, {
        components,
        defaultProps: {
            hasCheckbox: false,
            hasMarkAsReadIcon: false,
            hasReplyIcon: false,
            isSelected: false,
        },
        props: {
            hasCheckbox: Boolean,
            hasMarkAsReadIcon: Boolean,
            hasReplyIcon: Boolean,
            isSelected: Boolean,
            messageLocalId: String,
            threadViewLocalId: {
                type: String,
                optional: true,
            },
        },
        template: "ssi_web_inbox.InboxMessageRow",
    });

    return InboxMessageRow;
});
