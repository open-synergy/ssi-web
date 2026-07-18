# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Widget Many2one Reference Clickable",
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
            "ssi_web_widget_many2onereference_clickable/static/src/fields/"
            "many2one_reference_clickable/*",
        ],
        "web.assets_unit_tests": [
            "ssi_web_widget_many2onereference_clickable/static/tests/*",
        ],
    },
    "demo": [],
}
