# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Widget Ace - Fetch from GitHub",
    "version": "14.0.1.1.0",
    "summary": "Extends the Ace code widget with a button to fetch file content from GitHub",
    "website": "https://simetri-sinergi.id",
    "author": "PT. Simetri Sinergi Indonesia, OpenSynergy Indonesia",
    "license": "AGPL-3",
    "installable": True,
    "application": False,
    "depends": [
        "web",
    ],
    "data": [
        "views/assets.xml",
    ],
    "demo": [],
    "external_dependencies": {
        "python": ["requests"],
    },
}
