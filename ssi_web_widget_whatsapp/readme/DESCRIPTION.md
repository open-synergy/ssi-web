A field widget (`whatsapp_message`) that renders a `Char` field containing a
phone number as a single clickable WhatsApp icon button, ported from the
14.0 module of the same name.

When applied to a field in **readonly mode**, the widget shows a WhatsApp
icon button that opens `https://wa.me/<digits>` in a new browser tab, where
`<digits>` is the field value with every non-digit character stripped. In
edit mode, and whenever the value is empty, nothing is rendered.

Unlike the 14.0 module, this port does not monkeypatch any core view
renderer: Odoo 19's `Field` component already resolves the widget to use
per `<field>` node, so a field can be shown more than once in the same
form with a different `widget=` on each occurrence without any extra code.
