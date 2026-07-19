/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {ConfirmationDialog} from "@web/core/confirmation_dialog/confirmation_dialog";
import {_t} from "@web/core/l10n/translation";
import {actionService} from "@web/webclient/actions/action_service";
import {patch} from "@web/core/utils/patch";

/**
 * Shows a confirmation dialog before any `ir.actions.server` is executed,
 * regardless of how it was triggered (cog menu, form/list button, ...).
 *
 * Ported from the 14.0 module of the same name, which patched
 * `web.ActionManager` (`_handleAction`/`_onClickServerAction`). Neither API
 * exists in Odoo 19 — `ActionManager` is gone, and the equivalent logic in
 * `@web/webclient/actions/action_service` lives inside private closures
 * (`_executeServerAction`, only reached through the `switch` inside the
 * private `doAction` function) that `patch()` cannot reach. The
 * `action_handlers` registry is not an alternative either: it is only
 * consulted for action types unknown to that `switch`, and
 * `ir.actions.server` is always known.
 *
 * The only reachable seam is the service object itself
 * (`registry.category("services").add("action", actionService)`): this
 * patch wraps its public `doAction` and `doActionButton` methods. Both are
 * wrapped because a server action triggered from the cog menu
 * (`@web/search/action_menus/action_menus.js`, `executeAction`) calls
 * `doAction` directly with a numeric action id, while a server action bound
 * to a view button (`type="action"`) goes through `doActionButton`
 * (`useViewButtons`) instead.
 *
 * Neither entry point receives the action's `type` up front — the cog menu
 * only has the numeric id, and a button only has `params.name`. Both are
 * resolved with a single read on `ir.actions.actions`, the base model
 * shared by every concrete action type (`ir.actions.server`,
 * `ir.actions.act_window`, ...); this is a safe, read-only lookup that only
 * inspects the action definition, it never runs the server action's code.
 *
 * If the user declines, `doAction`/`doActionButton` resolve without
 * executing the action (they never reject), so the caller never sees a
 * traceback for a deliberately skipped action.
 */
patch(actionService, {
    dependencies: [...actionService.dependencies, "orm"],

    start(env) {
        const superReturn = super.start(env);

        /**
         * @param {number|string|object|undefined} actionRequest
         * @returns {Promise<{type?: string, name?: string}>}
         */
        async function getActionInfo(actionRequest) {
            if (actionRequest && typeof actionRequest === "object") {
                return {type: actionRequest.type, name: actionRequest.name};
            }
            const actionId = parseInt(actionRequest, 10);
            if (!actionId) {
                return {};
            }
            const [action] = await env.services.orm.read(
                "ir.actions.actions",
                [actionId],
                ["name", "type"]
            );
            return action || {};
        }

        /**
         * @param {number|string|object|undefined} actionRequest
         * @returns {Promise<boolean>} false means the user declined.
         */
        async function confirmIfServerAction(actionRequest) {
            const {type, name} = await getActionInfo(actionRequest);
            if (type !== "ir.actions.server") {
                return true;
            }
            const actionLabel = name || _t("this action");
            return new Promise((resolve) => {
                env.services.dialog.add(ConfirmationDialog, {
                    body: _t(
                        "Are you sure you want to run the action %s?",
                        actionLabel
                    ),
                    confirm: () => resolve(true),
                    cancel: () => resolve(false),
                });
            });
        }

        return {
            ...superReturn,
            doAction: async (actionRequest, options = {}) => {
                if (!(await confirmIfServerAction(actionRequest))) {
                    return;
                }
                return superReturn.doAction(actionRequest, options);
            },
            doActionButton: async (params, options = {}) => {
                const actionRequest =
                    params.type === "action" ? params.name : undefined;
                if (!(await confirmIfServerAction(actionRequest))) {
                    return;
                }
                return superReturn.doActionButton(params, options);
            },
        };
    },
});
