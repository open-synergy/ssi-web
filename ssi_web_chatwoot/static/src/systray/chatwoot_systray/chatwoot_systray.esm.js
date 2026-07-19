// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

import {Component, onMounted, onWillStart, useState} from "@odoo/owl";
import {registry} from "@web/core/registry";
import {useService} from "@web/core/utils/hooks";

/**
 * Systray entry that boots the Chatwoot Website Widget SDK and toggles
 * its panel. The SDK opens its own websocket (ActionCable) inside its
 * iframe, so replies from support agents appear without any Odoo-side
 * polling, bus, or controller.
 */
export class ChatwootSystray extends Component {
    static template = "ssi_web_chatwoot.ChatwootSystray";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.state = useState({settings: null, unreadCount: 0});

        onWillStart(async () => {
            this.state.settings = await this.orm.call(
                "chatwoot_configuration",
                "get_widget_settings",
                []
            );
        });

        onMounted(() => {
            if (this.state.settings && this.state.settings.enabled) {
                this._bootChatwootSdk();
            }
        });
    }

    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _bootChatwootSdk() {
        // Guard against re-mount: this component may be re-rendered by
        // its own reactive state (e.g. state.unreadCount) or by an
        // unrelated update of the systray registry. Re-running this must
        // not re-append the SDK <script> tag nor reset the SDK's own
        // internal state (visitor identity, open/closed panel, ...).
        if (window.$chatwoot || window.chatwootSDK) {
            return;
        }

        const settings = this.state.settings;

        window.chatwootSettings = {
            hideMessageBubble: true,
            position: settings.position,
            locale: settings.locale,
            type: settings.type,
            launcherTitle: settings.launcher_title,
        };

        window.addEventListener("chatwoot:ready", () => this._onChatwootReady());
        window.addEventListener("chatwoot:on-message", () => this._onUnreadMessage());
        window.addEventListener("chatwoot:opened", () => this._resetUnreadCounter());

        const script = document.createElement("script");
        script.async = true;
        script.defer = true;
        script.src = `${settings.base_url}/packs/js/sdk.js`;
        script.onload = () => {
            window.chatwootSDK.run({
                websiteToken: settings.website_token,
                baseUrl: settings.base_url,
            });
        };
        document.body.appendChild(script);
    }

    _onChatwootReady() {
        const user = this.state.settings.user;
        window.$chatwoot.setUser(user.identifier, {
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            identifier_hash: user.identifier_hash || undefined,
        });
        window.$chatwoot.setCustomAttributes(this.state.settings.custom_attributes);
    }

    _onUnreadMessage() {
        this.state.unreadCount += 1;
    }

    _resetUnreadCounter() {
        this.state.unreadCount = 0;
    }

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------

    onToggleClick(ev) {
        ev.preventDefault();
        if (window.$chatwoot) {
            window.$chatwoot.toggle();
        }
    }
}

export const chatwootSystrayItem = {Component: ChatwootSystray};

// Sequence 24 sits immediately next to "mail.messaging_menu" (sequence 25,
// addons/mail/static/src/core/public_web/messaging_menu.js) so the support
// chat button renders adjacent to the internal chat icon.
registry
    .category("systray")
    .add("ssi_web_chatwoot.chatwoot_systray", chatwootSystrayItem, {sequence: 24});
