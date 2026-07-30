# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebInbox(YamlTransactionCase):
    """Cover the per user read/unread state added on ``mail.message``."""

    def _create_message(self, name):
        """Create a comment message attached to a fresh partner.

        :param name: name given to the partner carrying the message
        :return: a single ``mail.message`` record
        """
        partner = self.env["res.partner"].create({"name": name})
        return self.env["mail.message"].create(
            {
                "model": "res.partner",
                "res_id": partner.id,
                "message_type": "comment",
                "subtype_id": self.env.ref("mail.mt_comment").id,
                "body": "<p>Inbox test message</p>",
            }
        )

    def test_ssi_web_inbox(self):
        """Run the read/unread scenarios for ``mail.message``."""
        self.run_yaml_scenario("test_data_ssi_web_inbox.yaml")

    def test_get_message_format_fields(self):
        """Assert ``inbox_read_partner_ids`` is offered to the client.

        Pure Python — trigger P1 (L-01: ``action: call`` discards the
        return value of the method, and L-02: the actual side of a YAML
        assert is always a field of a record in the registry, so the
        returned list cannot be inspected there at all).
        """
        fnames = self.env["mail.message"]._get_message_format_fields()
        self.assertIn("inbox_read_partner_ids", fnames)

    def test_message_format_carries_read_partner_ids(self):
        """Assert ``_message_format`` carries the read partner ids.

        Pure Python — triggers P1 and P4 (L-01: the return value of the
        method is discarded by ``action: call``, and L-07: the result is
        a list of dicts, which a YAML assert cannot subscript per key).

        Runs as ``base.user_admin`` rather than the default uid=1:
        ``base.partner_root`` is archived in core data and reading a
        many2many to ``res.partner`` applies ``active_test``, so the
        link would be filtered out of the payload again.
        """
        reader = self.env.ref("base.user_admin")
        message = self._create_message("Inbox Format Partner")
        message = message.with_user(reader)
        message.inbox_set_read()
        formatted = message._message_format(message._get_message_format_fields())
        self.assertEqual(len(formatted), 1)
        self.assertIn("inbox_read_partner_ids", formatted[0])
        self.assertEqual(
            formatted[0]["inbox_read_partner_ids"],
            [reader.partner_id.id],
        )
