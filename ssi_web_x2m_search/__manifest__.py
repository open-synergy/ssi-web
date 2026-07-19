# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Web X2Many Search",
    "version": "19.0.1.0.0",
    "summary": "Adds a search box that filters the rows already loaded in a "
    "one2many/many2many list field",
    "website": "https://simetri-sinergi.id",
    "author": "OpenSynergy Indonesia, PT. Simetri Sinergi Indonesia",
    "contributors": [
        "Andhitia Rama <andhitia.r@gmail.com>",
    ],
    "license": "AGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
    "depends": [
        "web",
    ],
    "assets": {
        "web.assets_backend": [
            "ssi_web_x2m_search/static/src/components/x2m_search/*",
        ],
        "web.assets_unit_tests": [
            "ssi_web_x2m_search/static/tests/*",
        ],
    },
    "demo": [],
}
