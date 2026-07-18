Open any record that has a chatter with attachments (e.g. a saved record
with a file already uploaded). Hover over an attachment card: a pencil
("Rename") icon appears alongside the existing Download/Remove icons.

Click it to open the **Edit Attachment Name** dialog, change the name and
click **Save**. The attachment card updates immediately, without reloading
the page, and the new name is persisted on `ir.attachment.name`.

Clicking **Cancel**, or saving with an empty or unchanged name, leaves the
attachment untouched and does not trigger any RPC call.
