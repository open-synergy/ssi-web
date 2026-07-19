# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebGantt(YamlTransactionCase):
    def test_ssi_web_gantt(self):
        self.run_yaml_scenario("test_data_ssi_web_gantt.yaml")

    def test_get_view_info_lists_ssi_gantt(self):
        """Python murni — pemicu P1 (L-01: `action: call` membuang nilai
        balik method).

        `_get_view_info()`/`get_view_info()` mengembalikan sebuah dict
        biasa, bukan efek samping pada record; YAML tidak punya cara
        meng-assert nilai balik method sama sekali.
        """
        view_info = self.env["ir.ui.view"]._get_view_info()
        self.assertIn("ssi_gantt", view_info)
        self.assertTrue(view_info["ssi_gantt"].get("icon"))

        full_view_info = self.env["ir.ui.view"].get_view_info()
        self.assertIn("ssi_gantt", full_view_info)
        self.assertTrue(full_view_info["ssi_gantt"]["display_name"])
        self.assertTrue(full_view_info["ssi_gantt"]["icon"])
