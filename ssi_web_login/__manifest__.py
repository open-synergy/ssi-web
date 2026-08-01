# Copyright 2025 OpenSynergy Indonesia
# Copyright 2025 PT. Simetri Sinergi Indonesia
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
{
    "name": "SSI Web Login",
    "version": "14.0.1.1.1",
    "website": "https://simetri-sinergi.id",
    "author": "PT. Simetri Sinergi Indonesia, OpenSynergy Indonesia",
    "license": "LGPL-3",
    "installable": True,
    "application": False,
    "depends": [
        "web",
        "auth_signup",
    ],
    "data": [
        "data/auth_signup_mail_template_data.xml",
        "views/webclient_templates.xml",
        "views/auth_signup_templates.xml",
    ],
    "demo": [],
}
