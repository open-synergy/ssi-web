This module has no user interface of its own. It exposes state that other
modules build on.

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
