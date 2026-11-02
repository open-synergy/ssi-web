# Copyright 2025 OpenSynergy Indonesia
# Copyright 2025 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebListDragScroll(YamlTransactionCase):
    """Install check for the drag scroll module."""

    def test_ssi_web_list_drag_scroll(self):
        """Run the YAML scenario that checks the module is installed."""
        self.run_yaml_scenario("test_data_ssi_web_list_drag_scroll.yaml")
