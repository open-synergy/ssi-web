# Copyright 2024 OpenSynergy Indonesia
# Copyright 2024 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
{
    "name": "Web Edit Attachment Name",
    "version": "14.0.1.0.0",
    "website": "https://simetri-sinergi.id",
    "author": "PT. Simetri Sinergi Indonesia, OpenSynergy Indonesia",
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "auto_install": False,
    "depends": [
        "mail",
    ],
    "data": [
        "views/assets.xml",
    ],
    "qweb": [
        "static/src/xml/edit_attachment_name.xml",
    ],
    "demo": [],
}
