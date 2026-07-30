# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebInboxAction(YamlTransactionCase):
    """Cover the inbox client action and the Discuss menu override."""

    def test_ssi_web_inbox_action(self):
        """Run the client action scenarios."""
        self.run_yaml_scenario("test_data_ssi_web_inbox_action.yaml")

    def test_discuss_menu_opens_the_inbox_action(self):
        """Assert the Discuss menu was re-pointed to the inbox action.

        The negative half of the assertion matters as much as the
        positive one: adding a client action that nothing opens would
        satisfy the scenarios above while leaving the menu on the
        standard Discuss action.

        Pure Python — triggers P1 (L-01: the value under test is what
        ``menu.action`` returns, and ``action: call`` discards return
        values; L-02: the actual side of a YAML assert is a dotted
        ``getattr`` on a record of the registry, so neither the model of
        a ``Reference`` field nor an inequality against another record
        can be expressed there).
        """
        menu = self.env.ref("mail.menu_root_discuss")
        action = menu.action
        self.assertEqual(action._name, "ir.actions.client")
        self.assertEqual(action.tag, "ssi_web_inbox.inbox")
        self.assertNotEqual(action, self.env.ref("mail.action_discuss"))
