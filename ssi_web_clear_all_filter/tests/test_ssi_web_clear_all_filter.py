# Copyright 2023 OpenSynergy Indonesia
# Copyright 2023 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebClearAllFilter(YamlTransactionCase):
    def test_ssi_web_clear_all_filter(self):
        self.run_yaml_scenario("test_data_ssi_web_clear_all_filter.yaml")
