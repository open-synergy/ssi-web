# Copyright 2025 OpenSynergy Indonesia
# Copyright 2025 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebWidgetJson(YamlTransactionCase):
    def test_ssi_web_widget_json(self):
        self.run_yaml_scenario("test_data_ssi_web_widget_json.yaml")
