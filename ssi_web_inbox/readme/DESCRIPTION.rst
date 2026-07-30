Odoo 14 marks a message as "seen" through the *needaction* mechanism:
``set_message_done`` removes the message from Inbox and moves it to History.
That is not a read/unread flag the way an e-mail client has one — in Gmail a
message that has been opened stays in the Inbox, it only stops being bold.

No field on ``mail.message`` records "this user has read this message" without
also taking the message out of the Inbox, so a Gmail-like inbox view has no
data to decide which rows to render as bold.

This module adds that missing state. ``mail.message`` gains a read/unread flag
**per user**, stored independently from *needaction*, readable from the web
client through ``_message_format`` and changeable through RPC methods.

Nothing of the standard behaviour changes: ``set_message_done``, the
*needaction* counters and the Inbox mailbox all keep working exactly as
before. The module only adds state; rendering an inbox with it is out of
scope here.
