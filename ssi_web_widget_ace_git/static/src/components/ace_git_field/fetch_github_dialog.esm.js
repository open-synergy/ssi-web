/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component, useState} from "@odoo/owl";
import {Dialog} from "@web/core/dialog/dialog";
import {_t} from "@web/core/l10n/translation";
import {rpc} from "@web/core/network/rpc";
import {useService} from "@web/core/utils/hooks";

/**
 * Dialog asking for a GitHub file URL (and, for private repositories, an
 * optional Personal Access Token), then calling the backend proxy
 * controller `/ssi_web_widget_ace_git/fetch_github` and handing the
 * fetched content back to the caller through `props.onFetched`.
 *
 * Uses the dialog service (`@web/core/dialog/dialog_service`, via
 * `useService("dialog")`) and the RPC service
 * (`@web/core/network/rpc`) — the 14.0 counterparts (`web.Dialog`,
 * `ajax.jsonRpc`) do not exist in Odoo 19. The controller route itself
 * (`auth="user"`, GitHub host allowlist) is unchanged from the 14.0 port
 * apart from `type="json"` → `type="jsonrpc"` (Odoo 19 renamed the route
 * type; `json` is now a deprecated alias with identical behaviour — see
 * `odoo/upgrade_code/18.1-02-route-jsonrpc.py`), and `rpc()` speaks the
 * same JSON-RPC envelope that route expects.
 */
export class FetchGitHubDialog extends Component {
    static template = "ssi_web_widget_ace_git.FetchGitHubDialog";
    static components = {Dialog};
    static props = {
        close: Function,
        onFetched: Function,
    };

    setup() {
        this.notification = useService("notification");
        this.state = useState({
            githubUrl: "",
            githubToken: "",
            fetching: false,
        });
    }

    get title() {
        return _t("Fetch File from GitHub");
    }

    /**
     * Calls the backend proxy and, on success, hands the fetched content
     * to `props.onFetched` and closes the dialog. On failure, shows a
     * notification with the backend's error message and keeps the dialog
     * open so the user can retry.
     */
    async onClickFetch() {
        const githubUrl = this.state.githubUrl.trim();
        if (!githubUrl) {
            this.notification.add(_t("Please enter a GitHub file URL first."), {
                type: "warning",
            });
            return;
        }

        this.state.fetching = true;
        try {
            const result = await rpc("/ssi_web_widget_ace_git/fetch_github", {
                github_url: githubUrl,
                github_token: this.state.githubToken.trim(),
            });
            if (
                result &&
                !result.error &&
                result.content !== null &&
                result.content !== undefined
            ) {
                this.props.onFetched(result.content);
                this.props.close();
            } else {
                this.notification.add(
                    (result && result.error) || _t("An unknown error occurred."),
                    {type: "danger", title: _t("Failed to Fetch File")}
                );
            }
        } catch {
            this.notification.add(
                _t(
                    "Failed to reach the backend server. Please check the server logs and try again."
                ),
                {type: "danger", title: _t("Error")}
            );
        } finally {
            this.state.fetching = false;
        }
    }
}
