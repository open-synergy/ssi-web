/* Copyright 2026 OpenSynergy Indonesia
 * Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component} from "@odoo/owl";
import {Dialog} from "@web/core/dialog/dialog";
import {_t} from "@web/core/l10n/translation";
import {useAutofocus} from "@web/core/utils/hooks";

/**
 * Dialog used to rename an `ir.attachment` record from the chatter
 * attachment list.
 *
 * The name input is deliberately *uncontrolled*: it is set once from
 * `props.currentName` and read back from the DOM (via `this.inputRef`)
 * only when the user confirms, instead of mirroring every keystroke back
 * into a reactive OWL state. That avoids re-rendering the input on every
 * keystroke while the user is typing.
 */
export class AttachmentRenameDialog extends Component {
    static template = "ssi_web_edit_attachment_name.AttachmentRenameDialog";
    static components = {Dialog};
    static props = {
        close: Function,
        currentName: String,
        save: Function,
    };

    setup() {
        this.inputRef = useAutofocus({selectAll: true});
    }

    get title() {
        return _t("Edit Attachment Name");
    }

    onKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.onClickSave();
        } else if (ev.key === "Escape") {
            ev.preventDefault();
            this.onClickCancel();
        }
    }

    onClickSave() {
        const newName = (this.inputRef.el?.value || "").trim();
        if (newName && newName !== this.props.currentName) {
            this.props.save(newName);
        }
        this.props.close();
    }

    onClickCancel() {
        this.props.close();
    }
}
