# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Web Server Action Confirmation",
    "version": "19.0.1.0.0",
    "summary": "Asks for confirmation before running any server action",
    "website": "https://simetri-sinergi.id",
    "author": "OpenSynergy Indonesia, PT. Simetri Sinergi Indonesia",
    "contributors": [
        "Andhitia Rama <andhitia.r@gmail.com>",
    ],
    "license": "AGPL-3",
    "installable": True,
    "application": False,
    "auto_install": True,
    "depends": [
        "web",
    ],
    "assets": {
        "web.assets_backend": [
            "ssi_web_server_action_confirmation/static/src/components/"
            "action_confirmation/*",
        ],
        "web.assets_unit_tests": [
            "ssi_web_server_action_confirmation/static/tests/*",
        ],
    },
    "demo": [],
}
