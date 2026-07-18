Adds a **Rename** action to attachment cards in the chatter, so users can
change an `ir.attachment` name without opening a separate form, ported from
the 14.0 module of the same name.

The 14.0 implementation used `odoo.define`, the legacy `web.Dialog` widget
and `t-inherit="mail.Attachment"`. None of these exist in Odoo 19: this port
is a full rewrite that patches `AttachmentList`
(`@mail/core/common/attachment_list`, template `mail.AttachmentList`) with
`patch()`, and opens the rename dialog through the dialog service
(`useService("dialog")`) instead of the legacy `web.Dialog` widget.

The rename icon is shown on the desktop hover overlay of the attachment
card, and as a "Rename" entry in the actions dropdown on mobile, only when
the attachment is already saved (not uploading) and editable.
