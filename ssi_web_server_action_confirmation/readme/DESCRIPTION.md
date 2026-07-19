Adds a confirmation dialog before any `ir.actions.server` is executed, no
matter how it was triggered — the cog ("Action") menu, a form button, or a
list button.

Ported from the 14.0 module of the same name, which patched `web.ActionManager`
(`_handleAction`/`_onClickServerAction`). Neither `ActionManager` nor those
methods exist in Odoo 19; this port instead patches the public `doAction` and
`doActionButton` methods of the `action` service
(`@web/webclient/actions/action_service`), the only part of that service
reachable with `patch()`.

The dialog applies globally, to every server action, without a per-record
opt-in field — one accidental click on a destructive cog-menu action is
exactly what this module protects against.
