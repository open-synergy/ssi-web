# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Widget Ace - Fetch from GitHub",
    "version": "19.0.1.0.0",
    "summary": "Extends the Ace code widget with a button to fetch file content "
    "from GitHub",
    "website": "https://simetri-sinergi.id",
    "author": "PT. Simetri Sinergi Indonesia, OpenSynergy Indonesia",
    "contributors": [
        "Andhitia Rama <andhitia.r@gmail.com>",
    ],
    "license": "AGPL-3",
    "installable": True,
    "application": False,
    "depends": [
        "web",
    ],
    "assets": {
        "web.assets_backend": [
            "ssi_web_widget_ace_git/static/src/components/ace_git_field/*",
        ],
        "web.assets_unit_tests": [
            "ssi_web_widget_ace_git/static/tests/*",
        ],
    },
    "demo": [],
    "external_dependencies": {
        "python": ["requests"],
    },
}
