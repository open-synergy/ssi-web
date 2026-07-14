# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebGantt(YamlTransactionCase):
    def test_ssi_web_gantt(self):
        self.run_yaml_scenario("test_data_ssi_web_gantt.yaml")

    def test_form_view_id_resolved_to_numeric_id(self):
        # Written in Python rather than in the YAML scenario because the
        # resolution is only observable in the return value of fields_view_get,
        # and a YAML step can only assert fields on a record.
        form_view = self.env.ref("base.view_partner_form")
        view = self.env["ir.ui.view"].create(
            {
                "name": "Partner SSI Gantt Resolved Form View",
                "model": "res.partner",
                "type": "ssi_gantt",
                "arch": """
                <ssi_gantt
                    date_start="create_date"
                    date_stop="write_date"
                    event_open_popup="1"
                    form_view_id="base.view_partner_form"
                />
                """,
            }
        )
        result = self.env["res.partner"].fields_view_get(
            view_id=view.id, view_type="ssi_gantt"
        )
        self.assertIn('form_view_id="%s"' % form_view.id, result["arch"])
