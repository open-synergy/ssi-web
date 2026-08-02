# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebShowHidePassword(YamlTransactionCase):
    """Cover the server side footprint of the show/hide password module.

    The module ships no model, so what is verifiable server side is
    that it installs and that its ``web.assets_common`` inheritance --
    the single registration point feeding both the login page and the
    backend -- really landed in ``ir.ui.view``.
    """

    def test_ssi_web_show_hide_password(self):
        """Run the installation and asset registration scenarios."""
        self.run_yaml_scenario("test_data_ssi_web_show_hide_password.yaml")
