/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {AceField} from "@web/views/fields/ace/ace_field";
import {FetchGitHubDialog} from "./fetch_github_dialog.esm";
import {_t} from "@web/core/l10n/translation";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

/**
 * Adds a "Fetch from GitHub" button below the Ace/Code editor
 * (`widget="ace"` / `widget="code"`) that opens a dialog where the user
 * enters a GitHub file URL (and, for private repositories, an optional
 * Personal Access Token). The content is fetched through the existing
 * backend proxy controller `/ssi_web_widget_ace_git/fetch_github`
 * (unchanged from the 14.0 port — see `controllers/github_proxy.py`,
 * kept exactly as-is per the module's design decision) and injected
 * into the editor.
 *
 * Ported from the 14.0 module of the same name, which used
 * `basic_fields.AceEditor.include({...})`. That mixin point does not
 * exist in Odoo 19 — `AbstractField`/`basic_fields` have been removed
 * entirely. The equivalent component is `AceField`
 * (`@web/views/fields/ace/ace_field`, template `web.AceField`),
 * registered under both `registry.category("fields")` keys `ace` and
 * `code` — both point at the same class, so patching the prototype once
 * covers both widget names.
 */
patch(AceField.prototype, {
    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.notification = useService("notification");
    },

    /**
     * Opens the "Fetch from GitHub" dialog.
     */
    onClickFetchFromGithub() {
        this.dialog.add(FetchGitHubDialog, {
            onFetched: (content) => this.applyFetchedContent(content),
        });
    },

    /**
     * Injects content fetched from GitHub into the field and marks the
     * record as changed, mirroring `AceField.commitChanges()`.
     *
     * @param {String} content
     */
    async applyFetchedContent(content) {
        this.state.initialValue = content;
        this.isDirty = false;
        await this.props.record.update({[this.props.name]: content});
        this.props.record.model.bus.trigger("FIELD_IS_DIRTY", false);
        this.notification.add(_t("File content successfully fetched from GitHub."), {
            type: "success",
        });
    },
});
