# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo import api, fields, models


class MailMessage(models.Model):
    """Add a per user read/unread state on top of ``mail.message``.

    Odoo marks a message as "done" through the *needaction* mechanism:
    ``set_message_done`` drops the message from Inbox and moves it to
    History. That is not a Gmail-like read flag — a message that has
    been opened stays in the Inbox there, it only stops being bold.

    This model stores the read state separately from *needaction*, so a
    Gmail-like inbox can render a message as read without removing it
    from the Inbox mailbox, and without changing any standard
    behaviour.
    """

    _inherit = "mail.message"

    inbox_read_partner_ids = fields.Many2many(
        "res.partner",
        "mail_message_res_partner_inbox_read_rel",
        string="Read By",
        help="Partners who have marked this message as read. Independent "
        "from the needaction mechanism: a message can be read and still "
        "belong to the Inbox mailbox.",
    )
    inbox_read = fields.Boolean(
        string="Read",
        compute="_compute_inbox_read",
        search="_search_inbox_read",
        compute_sudo=False,
        help="Whether the current user has marked this message as read.",
    )

    @api.depends("inbox_read_partner_ids")
    @api.depends_context("uid")
    def _compute_inbox_read(self):
        """Compute whether the current user has read the message.

        Reads ``inbox_read_partner_ids`` in ``sudo`` because a regular
        user has no read access to that relation, while the resulting
        value stays bound to the calling user through
        ``depends_context("uid")``.
        """
        partner = self.env.user.partner_id
        read_messages = self.sudo().filtered(
            lambda msg: partner in msg.inbox_read_partner_ids
        )
        for message in self:
            message.inbox_read = message in read_messages

    @api.model
    def _search_inbox_read(self, operator, operand):
        """Translate a search on ``inbox_read`` into a partner domain.

        :param operator: search operator, only ``=`` is meaningful here
        :param operand: value searched for, truthy means "read"
        :return: a domain on ``inbox_read_partner_ids``
        """
        partner_id = self.env.user.partner_id.id
        if operator == "=" and operand:
            return [("inbox_read_partner_ids", "in", [partner_id])]
        return [("inbox_read_partner_ids", "not in", [partner_id])]

    def inbox_set_read(self):
        """Mark the messages as read for the current user.

        Writes in ``sudo`` because a regular user is not allowed to
        write on ``mail.message``, mirroring ``toggle_message_starred``.
        Read access on the messages is still enforced first, so a user
        cannot flag a message they may not even see.

        :return: ``True``
        """
        self.check_access_rule("read")
        self.sudo().write(
            {"inbox_read_partner_ids": [(4, self.env.user.partner_id.id)]}
        )
        return True

    def inbox_set_unread(self):
        """Mark the messages as unread for the current user.

        Removing a partner that is not linked is a no-op, so calling
        this on a message that was never read is harmless.

        :return: ``True``
        """
        self.check_access_rule("read")
        self.sudo().write(
            {"inbox_read_partner_ids": [(3, self.env.user.partner_id.id)]}
        )
        return True

    def inbox_toggle_read(self):
        """Flip the read state of every message for the current user.

        The state is evaluated per record, so a recordset holding both
        read and unread messages ends up with each of them inverted
        rather than aligned on a single value.

        :return: ``True``
        """
        for message in self:
            if message.inbox_read:
                message.inbox_set_unread()
            else:
                message.inbox_set_read()
        return True

    def _get_message_format_fields(self):
        """Expose ``inbox_read_partner_ids`` to the web client.

        Appends the field to the list read by ``_message_format`` so the
        client side ``mail.message`` model can derive its own
        ``isInboxRead`` attribute the same way it derives ``isStarred``.

        :return: list of field names sent to the client
        """
        res = super(MailMessage, self)._get_message_format_fields()
        res.append("inbox_read_partner_ids")
        return res
