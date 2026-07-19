# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebChatwoot(YamlTransactionCase):
    def test_ssi_web_chatwoot(self):
        self.run_yaml_scenario("test_data_ssi_web_chatwoot.yaml")

    def test_get_widget_settings_enabled(self):
        """Python murni — pemicu P1 (L-01: `action: call` membuang nilai
        balik method).

        `get_widget_settings` mengembalikan sebuah dict biasa, bukan efek
        samping pada record; YAML tidak punya cara meng-assert nilai balik
        method sama sekali.
        """
        self.env["chatwoot_configuration"].create(
            {
                "name": "Active Configuration",
                "code": "/",
                "base_url": "https://chat.example.com",
                "website_token": "active-website-token",
                "active": True,
                "company_id": self.env.company.id,
            }
        )
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertTrue(settings["enabled"])
        self.assertEqual(settings["base_url"], "https://chat.example.com")
        self.assertEqual(settings["website_token"], "active-website-token")

    def test_get_widget_settings_disabled_no_active_configuration(self):
        """Python murni — pemicu P1 (L-01).

        Tanpa konfigurasi aktif, dict balikannya harus `enabled=False`; ini
        hanya bisa dibaca dari nilai balik method, bukan dari field record.
        """
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertFalse(settings["enabled"])

    def test_get_widget_settings_never_leaks_hmac_token(self):
        """Python murni — pemicu P1 (L-01).

        `hmac_token` tidak boleh pernah muncul di dict balikan, dan
        `identifier_hash` turunannya hanya bisa diperiksa dari nilai balik
        method itu sendiri.
        """
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
        self.assertNotIn("hmac_token", settings)
        self.assertNotIn("hmac_token", settings["user"])
        self.assertTrue(settings["user"]["identifier_hash"])

    def test_get_widget_settings_identity_validation_disabled(self):
        """Python murni — pemicu P1 (L-01).

        Saat `identity_validation_ok` bernilai False, `identifier_hash`
        pada dict balikan harus False — hanya bisa diperiksa dari nilai
        balik method.
        """
        self.env["chatwoot_configuration"].create(
            {
                "name": "Active Configuration",
                "code": "/",
                "base_url": "https://chat.example.com",
                "website_token": "active-website-token",
                "identity_validation_ok": False,
                "active": True,
                "company_id": self.env.company.id,
            }
        )
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertFalse(settings["user"]["identifier_hash"])

    def test_get_widget_settings_group_restricted(self):
        """Python murni — pemicu P1 (L-01).

        `enabled=False` untuk pemanggil yang tidak lolos cek `group_ids`;
        hanya bisa dibaca dari dict balikan method, bukan dari field
        record mana pun.
        """
        restricted_group = self.env["res.groups"].create(
            {"name": "Chatwoot Restricted Access"}
        )
        self.env["chatwoot_configuration"].create(
            {
                "name": "Restricted Configuration",
                "code": "/",
                "base_url": "https://chat.example.com",
                "website_token": "restricted-website-token",
                "active": True,
                "company_id": self.env.company.id,
                "group_ids": [(6, 0, [restricted_group.id])],
            }
        )
        settings = self.env["chatwoot_configuration"].get_widget_settings()
        self.assertFalse(settings["enabled"])
