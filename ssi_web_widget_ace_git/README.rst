==============================
Widget Ace - Fetch from GitHub
==============================

.. |badge1| image:: https://img.shields.io/badge/maturity-Beta-yellow.png
    :target: https://odoo-community.org/page/development-status
    :alt: Beta

|badge1|

This module extends the Odoo 14 Ace code editor widget (``FieldCode``) by adding
a **"Fetch from GitHub"** button directly below the editor area.

Clicking the button opens a dialog where the user can enter:

* A **GitHub file URL** (web URL or raw URL)
* An optional **GitHub Personal Access Token** (for private repositories)

The content is fetched via a backend Python proxy controller (to avoid CORS issues)
and injected directly into the active Ace editor.

**Features**

* Built with Odoo legacy JavaScript framework (no OWL)
* Backend proxy controller to avoid browser CORS restrictions
* Supports GitHub web URLs (``/blob/``) and raw URLs (``raw.githubusercontent.com``)
* Token-based authentication for private repositories
* Error/success notifications using native Odoo notification system

**Usage**

1. Open any form with an Ace code widget (e.g., Automated Actions, Server Actions)
2. Enter edit mode
3. Click **"Fetch from GitHub"** below the editor
4. Enter the GitHub file URL and optionally a Personal Access Token
5. Click **"Fetch & Apply"**

**Security**

The backend controller only allows requests to ``github.com``,
``raw.githubusercontent.com``, and ``api.github.com`` to prevent SSRF attacks.
Authentication requires a logged-in Odoo user (``auth="user"``).

Authors
~~~~~~~

* PT. Simetri Sinergi Indonesia
* OpenSynergy Indonesia
