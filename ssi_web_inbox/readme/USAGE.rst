Using the inbox
~~~~~~~~~~~~~~~

Open the **Discuss** menu. The mailbox sidebar (Inbox, Starred, History,
channels) is the standard one and behaves as usual; the message area is what
changed.

* Every message is one row: author, record name, a one line preview of the
  body, and the date. Hovering the date shows the full timestamp.
* **Click a row** to open the full message underneath it, and click it again
  to fold it back. Folding does not change the read state.
* Rows that you have not read yet are **bold**. Opening a row marks it as
  read; the envelope button on the right of the row flips the state back and
  forth without opening anything.
* An open row offers **Send message** and **Log note**. Both write to the
  document the message came from, the first as a public message
  (``mail.mt_comment``), the second as an internal note (``mail.mt_note``).
  Messages that belong to no document — Odoo notifications, for instance —
  show no such buttons.

Nothing here changes the standard Discuss client action: only the menu is
re-pointed, so ``mail.action_discuss`` still exists and still opens the
standard conversation view for whoever calls it directly.

Server side
~~~~~~~~~~~

``mail.message`` gains two fields:

+----------------------------+----------------------------------------------+
| Field                      | Meaning                                      |
+============================+==============================================+
| ``inbox_read_partner_ids`` | Many2many to ``res.partner``: everyone who   |
|                            | marked the message as read                   |
+----------------------------+----------------------------------------------+
| ``inbox_read``             | Boolean, computed and searchable: whether    |
|                            | the *current* user read the message          |
+----------------------------+----------------------------------------------+

``inbox_read`` is not stored and depends on the calling user, so the same
message is read for one user and unread for another. It can still be used in
a domain::

    self.env["mail.message"].search([("inbox_read", "=", False)])

Three methods change the state of the current user, each returning ``True``::

    messages.inbox_set_read()
    messages.inbox_set_unread()
    messages.inbox_toggle_read()

They write in ``sudo`` — a regular user has no write access on
``mail.message`` — but read access on the messages is checked first, so a
user cannot flag a message they may not see.

Client side
~~~~~~~~~~~

``inbox_read_partner_ids`` is appended to ``_get_message_format_fields()``, so
it travels with every ``_message_format()`` payload. The client side
``mail.message`` model is patched accordingly and gains:

* ``isInboxRead`` — boolean attribute, filled by ``convertData`` from the
  partner ids, the same way ``isStarred`` is filled;
* ``setInboxRead()`` and ``toggleInboxRead()`` — call the matching server
  method and then update the local state.

There is no bus notification when the state changes, so several tabs open on
the same session are not kept in sync.

The inbox itself is the client action ``ssi_web_inbox.inbox``, declared by
``ssi_web_inbox.action_inbox``. It extends the standard ``DiscussWidget``, so
the control panel, the search bar and the mailbox selection are inherited
untouched; only the rendering of the message list is replaced, and only when
the list is shown inside Discuss — the chatter of a form view and the chat
windows keep the standard conversation rendering.
