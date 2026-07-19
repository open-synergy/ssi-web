Embeds the Chatwoot Website Widget SDK into the Odoo backend as a systray
button, next to the internal chat icon, so internal users can reach the
support team in real time without leaving Odoo.

The active connection is configured through the **Chatwoot Configuration**
model (`chatwoot_configuration`, menu *Settings ▸ Technical ▸ Chatwoot
Configuration*), only one of which may be active per company. The systray
button loads the SDK straight from the configured Chatwoot instance
(`<base_url>/packs/js/sdk.js`) — no CDN and no SDK code is bundled into this
module.

Ported from the 14.0 module of the same name: the model and its
`get_widget_settings()` contract are unchanged; only the browser-side
systray widget has been rewritten for Odoo 19 (ESM, OWL component, the
`systray` registry, and the `orm` service instead of the legacy `_rpc`).
