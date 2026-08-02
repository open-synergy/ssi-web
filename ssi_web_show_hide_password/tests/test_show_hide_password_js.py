# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo.tests import HttpCase, tagged


@tagged("post_install", "-at_install")
class TestShowHidePasswordJs(HttpCase):
    """Execute the module's QUnit suite in a headless browser.

    Registering the QUnit file in ``web.qunit_suite_tests`` only makes
    it available on ``/web/tests``; nothing runs it unless the ``web``
    addon itself is under test. This case opens that page restricted to
    the module's own QUnit module so the browser assertions become part
    of this repository's CI run.
    """

    def test_qunit_show_hide_password(self):
        """Run the ``ssi_web_show_hide_password`` QUnit module.

        Pure Python -- trigger P7 (L-19: ``HttpCase`` browser
        automation is out of reach of the YAML DSL, whose base class is
        locked to ``TransactionCase``). Skips by itself when no Chrome
        binary is available on the runner.
        """
        self.browser_js(
            "/web/tests?module=ssi_web_show_hide_password&failfast",
            "",
            "",
            login="admin",
            timeout=1800,
        )
