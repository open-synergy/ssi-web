// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

odoo.define("ssi_web_chatwoot.ChatwootSystray", function (require) {
    "use strict";

    var SystrayMenu = require("web.SystrayMenu");
    var Widget = require("web.Widget");

    /**
     * Systray entry that boots the Chatwoot Website Widget SDK and
     * toggles its panel. The SDK opens its own websocket (ActionCable)
     * inside its iframe, so replies from support agents appear without
     * any Odoo-side polling, bus, or controller.
     */
    var ChatwootSystray = Widget.extend({
        name: "chatwoot_systray",
        template: "ssi_web_chatwoot.SystrayItem",
        events: {
            "click .o_chatwoot_toggler": "_onToggleClick",
        },

        willStart: function () {
            var self = this;
            return Promise.all([
                this._super.apply(this, arguments),
                this._rpc({
                    model: "chatwoot_configuration",
                    method: "get_widget_settings",
                }).then(function (settings) {
                    self._settings = settings;
                }),
            ]);
        },

        start: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                if (!self._settings || !self._settings.enabled) {
                    self.do_hide();
                    return;
                }
                self._unreadCount = 0;
                self._loadChatwootSdk();
            });
        },

        // ----------------------------------------------------------------
        // Private
        // ----------------------------------------------------------------

        _loadChatwootSdk: function () {
            var self = this;
            var settings = this._settings;

            window.chatwootSettings = {
                hideMessageBubble: true,
                position: settings.position,
                locale: settings.locale,
                type: settings.type,
                launcherTitle: settings.launcher_title,
            };

            window.addEventListener("chatwoot:ready", function () {
                self._onChatwootReady();
            });
            window.addEventListener("chatwoot:on-message", function () {
                self._onUnreadMessage();
            });
            window.addEventListener("chatwoot:opened", function () {
                self._resetUnreadCounter();
            });

            var script = document.createElement("script");
            script.async = true;
            script.defer = true;
            script.src = settings.base_url + "/packs/js/sdk.js";
            script.onload = function () {
                window.chatwootSDK.run({
                    websiteToken: settings.website_token,
                    baseUrl: settings.base_url,
                });
            };
            document.body.appendChild(script);
        },

        _onChatwootReady: function () {
            var settings = this._settings;
            var user = settings.user;
            window.$chatwoot.setUser(user.identifier, {
                name: user.name,
                email: user.email,
                avatar_url: user.avatar_url,
                identifier_hash: user.identifier_hash || undefined,
            });
            window.$chatwoot.setCustomAttributes(settings.custom_attributes);
        },

        _onUnreadMessage: function () {
            this._unreadCount += 1;
            this.$(".o_notification_counter").text(this._unreadCount);
            this.$el.toggleClass("o_no_notification", !this._unreadCount);
        },

        _resetUnreadCounter: function () {
            this._unreadCount = 0;
            this.$(".o_notification_counter").text("");
            this.$el.toggleClass("o_no_notification", true);
        },

        // ----------------------------------------------------------------
        // Handlers
        // ----------------------------------------------------------------

        _onToggleClick: function (ev) {
            ev.preventDefault();
            if (window.$chatwoot) {
                window.$chatwoot.toggle();
            }
        },
    });

    // Insert right after the internal chat (MessagingMenu) systray item.
    // SystrayMenu prepends widgets one by one while iterating its Items
    // array in order, so the DOM order ends up reversed: the item placed
    // immediately after MessagingMenu in the array is rendered immediately
    // to its left in the navbar. Exact adjacency also depends on where
    // unrelated systray modules insert themselves relative to this same
    // array, so it is best-effort rather than guaranteed.
    var messagingIndex = SystrayMenu.Items.findIndex(function (Item) {
        return Item.prototype.template === "mail.widgets.MessagingMenu";
    });
    if (messagingIndex > -1) {
        SystrayMenu.Items.splice(messagingIndex + 1, 0, ChatwootSystray);
    } else {
        SystrayMenu.Items.push(ChatwootSystray);
    }

    return ChatwootSystray;
});
