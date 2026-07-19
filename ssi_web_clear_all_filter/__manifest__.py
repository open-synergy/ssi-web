# Copyright 2023 OpenSynergy Indonesia
# Copyright 2023 PT. Simetri Sinergi Indonesia
# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Web Clear All Filter",
    "version": "19.0.1.0.0",
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
            "ssi_web_clear_all_filter/static/src/components/clear_all_filter/*",
        ],
        "web.assets_unit_tests": [
            "ssi_web_clear_all_filter/static/tests/*",
        ],
    },
    "demo": [],
}
