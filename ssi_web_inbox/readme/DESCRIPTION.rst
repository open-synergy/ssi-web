Odoo 14 marks a message as "seen" through the *needaction* mechanism:
``set_message_done`` removes the message from Inbox and moves it to History.
That is not a read/unread flag the way an e-mail client has one — in Gmail a
message that has been opened stays in the Inbox, it only stops being bold.

The Discuss screen has the matching limitation: every message is rendered in
full, as a chronological chat, so a cross-record Inbox cannot be scanned. A
user cannot look at twenty messages at once and then pick one to read.

This module fixes both halves.

Server side, ``mail.message`` gains a read/unread flag **per user**, stored
independently from *needaction*, readable from the web client through
``_message_format`` and changeable through RPC methods.

Client side, the Discuss menu opens a Gmail-like inbox: the mailbox sidebar
stays on the left, but messages are listed as compact rows showing the author,
the record name, a one line preview of the body and the date. Clicking a row
expands the full message in place, together with the buttons needed to answer
it or to log a note on the document the message came from. Unread rows are
bold, and opening one marks it as read.

Nothing of the standard behaviour changes: ``set_message_done``, the
*needaction* counters and the Inbox mailbox all keep working exactly as
before, and the standard ``mail.action_discuss`` client action is left
untouched so that modules referencing it stay valid.
