# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebX2mSearch(YamlTransactionCase):
    def test_ssi_web_x2m_search(self):
        self.run_yaml_scenario("test_data_ssi_web_x2m_search.yaml")
