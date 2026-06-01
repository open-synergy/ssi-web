# Copyright 2025 OpenSynergy Indonesia
# Copyright 2025 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebWidgetCopyContent(YamlTransactionCase):
    def test_ssi_web_widget_copy_content(self):
        self.run_yaml_scenario("test_data_ssi_web_widget_copy_content.yaml")
