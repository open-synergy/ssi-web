# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo_yaml_test import YamlTransactionCase

from odoo.tests import tagged

from ..controllers.github_proxy import GitHubProxyController


@tagged("post_install", "-at_install")
class TestSsiWebWidgetAceGit(YamlTransactionCase):
    def setUp(self):
        super().setUp()
        self.ctrl = GitHubProxyController()

    def test_ssi_web_widget_ace_git(self):
        self.run_yaml_scenario("test_data_ssi_web_widget_ace_git.yaml")

    def test_convert_to_raw_url_blob(self):
        url = "https://github.com/user/repo/blob/main/path/to/file.py"
        result = self.ctrl._convert_to_raw_url(url)
        self.assertEqual(
            result,
            "https://raw.githubusercontent.com/user/repo/main/path/to/file.py",
        )

    def test_convert_to_raw_url_already_raw(self):
        url = "https://raw.githubusercontent.com/user/repo/main/file.py"
        result = self.ctrl._convert_to_raw_url(url)
        self.assertEqual(result, url)

    def test_convert_to_raw_url_api(self):
        url = "https://api.github.com/repos/user/repo/contents/file.py"
        result = self.ctrl._convert_to_raw_url(url)
        self.assertEqual(result, url)

    def test_convert_to_raw_url_invalid(self):
        result = self.ctrl._convert_to_raw_url("https://example.com/not-github")
        self.assertIsNone(result)

    def test_is_allowed_url_github(self):
        self.assertTrue(
            self.ctrl._is_allowed_url(
                "https://raw.githubusercontent.com/user/repo/main/file.py"
            )
        )
        self.assertTrue(self.ctrl._is_allowed_url("https://github.com/user/repo"))
        self.assertTrue(
            self.ctrl._is_allowed_url("https://api.github.com/repos/user/repo")
        )

    def test_is_allowed_url_disallowed(self):
        self.assertFalse(self.ctrl._is_allowed_url("https://example.com/file"))
        self.assertFalse(
            self.ctrl._is_allowed_url("http://raw.githubusercontent.com/file")
        )

    def test_fetch_empty_url_returns_error(self):
        result = self.ctrl.fetch_github_content(github_url="")
        self.assertIsNone(result["content"])
        self.assertIn("empty", result["error"].lower())

    def test_fetch_invalid_url_returns_error(self):
        result = self.ctrl.fetch_github_content(github_url="https://notgithub.com/file")
        self.assertIsNone(result["content"])
        self.assertIsNotNone(result["error"])

    def test_fetch_disallowed_host_returns_error(self):
        result = self.ctrl.fetch_github_content(github_url="https://example.com/x.py")
        self.assertIsNone(result["content"])
        self.assertIsNotNone(result["error"])

    def test_fetch_non_https_scheme_returns_error(self):
        result = self.ctrl.fetch_github_content(
            github_url="http://github.com/user/repo/blob/main/file.py"
        )
        self.assertIsNone(result["content"])
        self.assertIsNotNone(result["error"])
