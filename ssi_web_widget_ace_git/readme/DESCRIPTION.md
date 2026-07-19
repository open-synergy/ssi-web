Adds a **"Fetch from GitHub"** button below any Ace/Code editor field
(`widget="ace"` or `widget="code"`, e.g. Automated Actions, Server Actions).

Clicking the button opens a dialog where the user can enter:

* A **GitHub file URL** (web URL or raw URL)
* An optional **GitHub Personal Access Token** (for private repositories)

The content is fetched via a backend Python proxy controller (to avoid CORS
restrictions in the browser) and injected directly into the active editor.

Ported from the 14.0 module of the same name. The backend proxy controller
(`/ssi_web_widget_ace_git/fetch_github`) is unchanged from the 14.0 port; only
the browser-side widget has been rewritten for Odoo 19 (ESM, the dialog
service, and the RPC service, patching the core `AceField` component instead
of the legacy `basic_fields.AceEditor` mixin).

**Security**

The backend controller only allows requests to `github.com`,
`raw.githubusercontent.com`, and `api.github.com` to prevent SSRF attacks.
Authentication requires a logged-in Odoo user (`auth="user"`). The token is
never logged or stored on the server.
