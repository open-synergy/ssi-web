# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.exceptions import ValidationError
from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebChatwoot(YamlTransactionCase):
    def test_ssi_web_chatwoot(self):
        self.run_yaml_scenario("test_data_ssi_web_chatwoot.yaml")

    def test_constrains_single_active_configuration(self):
        """A second active configuration in the same company must be
        rejected by the single-active-per-company constraint."""
        self.env["chatwoot_configuration"].create(
            {
                "name": "First Configuration",
                "code": "/",
                "base_url": "https://chat.example.com",
                "website_token": "first-website-token",
                "active": True,
                "company_id": self.env.company.id,
            }
        )
        with self.assertRaises(ValidationError):
            self.env["chatwoot_configuration"].create(
                {
                    "name": "Second Configuration",
                    "code": "/",
                    "base_url": "https://chat.example.com",
                    "website_token": "second-website-token",
                    "active": True,
                    "company_id": self.env.company.id,
                }
            )

    def test_get_widget_settings_enabled(self):
        """When an active configuration exists, get_widget_settings must
        report enabled=True and must never leak hmac_token."""
        self.env["chatwoot_configuration"].create(
            {
                "name": "Active Configuration",
                "code": "/",
                "base_url": "https://chat.example.com",
                "website_token": "active-website-token",
                "hmac_token": "super-secret-hmac",
                "identity_validation_ok": True,
                "active": True,
                "company_id": self.env.company.id,
            }
        )
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertTrue(settings["enabled"])
        self.assertNotIn("hmac_token", settings)
        self.assertNotIn("hmac_token", settings["user"])
        self.assertTrue(settings["user"]["identifier_hash"])

    def test_get_widget_settings_disabled(self):
        """When no active configuration exists, get_widget_settings must
        report enabled=False so the systray hides its button."""
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertFalse(settings["enabled"])
