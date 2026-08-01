# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo.tests import HttpCase, tagged


@tagged("post_install", "-at_install")
class TestAuthSignupLoginHttp(HttpCase):
    """Render the login and reset password pages over HTTP."""

    def setUp(self):
        """Activate the ``auth_signup.reset_password`` system parameter."""
        super().setUp()
        self.env["ir.config_parameter"].sudo().set_param(
            "auth_signup.reset_password", "True"
        )

    def test_login_page_shows_username_label(self):
        """Assert the login page uses "Username", not "Your Email".

        Pure Python -- trigger P7 (L-19: ``HttpCase``, a rendered HTTP
        response body, is unreachable from the YAML DSL, whose base
        class is locked to ``TransactionCase``). Also asserts the
        existing ``ssi_web_login.login`` view still renders the
        password field and the submit button.
        """
        response = self.url_open("/web/login")
        body = response.content.decode()
        self.assertIn("Username", body)
        self.assertNotIn("Your Email", body)
        self.assertIn('id="password"', body)
        self.assertIn('type="submit"', body)

    def test_reset_password_page_shows_username_label(self):
        """Assert the reset password page uses "Your Username".

        Pure Python -- trigger P7 (L-19: ``HttpCase``, a rendered HTTP
        response body, is unreachable from the YAML DSL, whose base
        class is locked to ``TransactionCase``).
        """
        response = self.url_open("/web/reset_password")
        body = response.content.decode()
        self.assertIn("Your Username", body)
        self.assertNotIn("Your Email", body)
