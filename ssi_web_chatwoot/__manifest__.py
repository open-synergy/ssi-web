# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "SSI Web Chatwoot",
    "version": "14.0.1.0.0",
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
        "mail",
        "ssi_master_data_mixin",
    ],
    "data": [
        "security/res_groups/chatwoot_configuration.xml",
        "security/ir_model_access/chatwoot_configuration.xml",
        "views/assets.xml",
        "views/chatwoot_configuration.xml",
    ],
    "qweb": [
        "static/src/xml/chatwoot_systray.xml",
    ],
    "demo": [],
}
