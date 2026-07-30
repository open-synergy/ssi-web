# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).
{
    "name": "Web Inbox",
    "category": "Web",
    "version": "14.0.1.1.0",
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
        "mail",
    ],
    "data": [
        "views/assets.xml",
        "views/inbox_action.xml",
    ],
    "qweb": [
        "static/src/xml/inbox_message_row.xml",
        "static/src/xml/message_list.xml",
    ],
    "demo": [],
}
