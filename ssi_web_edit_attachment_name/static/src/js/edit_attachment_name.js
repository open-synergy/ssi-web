odoo.define("ssi_web_edit_attachment_name.EditAttachmentName", function (require) {
    "use strict";

    var core = require("web.core");
    var Dialog = require("web.Dialog");
    var {patch} = require("web.utils");
    var _t = core._t;

    var Attachment = require("mail/static/src/components/attachment/attachment.js");

    patch(Attachment, "ssi_web_edit_attachment_name.EditAttachmentName", {
        /**
         * Handle click on the edit name icon.
         * Opens a dialog allowing the user to rename the attachment.
         *
         * @param {MouseEvent} ev
         */
        _onClickEditName(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            var self = this;
            var attachment = this.attachment;
            if (!attachment || attachment.isTemporary) {
                return;
            }
            var currentName = attachment.displayName || attachment.name || "";
            var $content = $("<div>").append(
                $("<label>", {
                    text: _t("New name:"),
                    for: "ssi_attachment_name_input",
                    class: "col-form-label",
                }),
                $("<input>", {
                    type: "text",
                    id: "ssi_attachment_name_input",
                    class: "form-control mt-2",
                    value: currentName,
                })
            );
            var dialog = new Dialog(null, {
                title: _t("Edit Attachment Name"),
                $content: $content,
                size: "medium",
                buttons: [
                    {
                        text: _t("Save"),
                        classes: "btn-primary",
                        close: true,
                        click: function () {
                            var newName = $content
                                .find("#ssi_attachment_name_input")
                                .val()
                                .trim();
                            if (newName && newName !== currentName) {
                                self.env.services
                                    .rpc({
                                        model: "ir.attachment",
                                        method: "write",
                                        args: [[attachment.id], {name: newName}],
                                    })
                                    .then(function () {
                                        attachment.update({
                                            name: newName,
                                        });
                                    });
                            }
                        },
                    },
                    {
                        text: _t("Cancel"),
                        close: true,
                    },
                ],
            });
            dialog.open();
        },
    });
});
