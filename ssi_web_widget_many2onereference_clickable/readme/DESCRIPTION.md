Registers the `many2one_reference` field widget for `reference` fields,
ported from the 14.0 module of the same name.

Odoo 19 already renders a readonly `reference` field as a clickable link
that opens the related record, on both form and list views, without any
widget needed. This module keeps the historical `many2one_reference`
widget name available as an explicit, unambiguous choice for `reference`
fields, so views written against the 14.0 module do not need to change.
The widget safely delegates to Odoo's own `Many2OneReferenceField` for
genuine `many2one_reference`-type fields (an unrelated, built-in field
type that happens to share the same widget name), so it does not change
behaviour for that type.
