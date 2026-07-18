/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {AttachmentList} from "@mail/core/common/attachment_list";
import {_t} from "@web/core/l10n/translation";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

import {AttachmentRenameDialog} from "./attachment_rename_dialog.esm";

/**
 * Adds a "Rename" action to each attachment card of the chatter attachment
 * list, opening a dialog to edit `ir.attachment.name` in place.
 *
 * Ported from the 14.0 module of the same name, which patched the legacy
 * OWL 1 `mail.Attachment` component and used the legacy `web.Dialog`
 * widget. In 19.0 the equivalent component is `AttachmentList`
 * (`@mail/core/common/attachment_list`, template `mail.AttachmentList`);
 * the rename dialog now goes through the dialog service
 * (`useService("dialog")`, already set up by the base component) instead
 * of `web.Dialog`.
 */
patch(AttachmentList.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
    },

    /**
     * The icon is only shown once the attachment is actually saved (not a
     * temporary/uploading one) and in a context where the attachment is
     * editable. `isDeletable` already encodes that second condition for
     * the existing Remove action, so it is reused here for Rename.
     *
     * @param {import("models").Attachment} attachment
     * @returns {Boolean}
     */
    canRename(attachment) {
        return !attachment.uploading && attachment.isDeletable;
    },

    /**
     * @param {import("models").Attachment} attachment
     */
    onClickRename(attachment) {
        this.dialog.add(AttachmentRenameDialog, {
            currentName: attachment.name || "",
            save: (newName) => this.renameAttachment(attachment, newName),
        });
    },

    /**
     * @param {import("models").Attachment} attachment
     * @param {String} newName
     */
    async renameAttachment(attachment, newName) {
        await this.orm.write("ir.attachment", [attachment.id], {name: newName});
        attachment.name = newName;
    },

    getActions(attachment) {
        const actions = super.getActions(...arguments);
        if (this.canRename(attachment)) {
            actions.push({
                label: _t("Rename"),
                icon: "fa fa-pencil",
                onSelect: () => this.onClickRename(attachment),
            });
        }
        return actions;
    },
});
