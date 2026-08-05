# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestIrUiMenu(YamlTransactionCase):
    """Scenario tests for the ``web_icon_permanent`` guard on
    ``ir.ui.menu``."""

    def test_ir_ui_menu(self):
        """Run the permanent icon write() guard scenarios."""
        self.run_yaml_scenario("test_data_ir_ui_menu.yaml")
