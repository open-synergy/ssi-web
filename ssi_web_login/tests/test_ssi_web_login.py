# Copyright 2025 OpenSynergy Indonesia
# Copyright 2025 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebLogin(YamlTransactionCase):
    """Scenario tests for the ``ssi_web_login`` module."""

    def test_ssi_web_login(self):
        """Run the install and auth signup override scenario."""
        self.run_yaml_scenario("test_data_ssi_web_login.yaml")

    def test_mail_template_login_line_has_no_email(self):
        """Assert mail template login lines omit ``${object.email}``.

        Pure Python -- trigger P4 (L-05: the YAML DSL only offers the
        ``contains`` operator; there is no ``not_contains`` nor regex
        to assert that a substring is absent).
        """
        set_password_tmpl = self.env.ref("auth_signup.set_password_email")
        signup_tmpl = self.env.ref(
            "auth_signup.mail_template_user_signup_account_created"
        )
        self.assertNotIn("?login=${object.email}", set_password_tmpl.body_html)
        self.assertNotIn("auth_login=${object.email}", signup_tmpl.body_html)
