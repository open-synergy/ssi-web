This module is `auto_install`: it activates automatically whenever `web`
is installed, no manual setup needed.

`reference` fields already render as a clickable open-record link in
readonly mode without any `widget=` — that is native Odoo 19 behaviour.
Apply the widget explicitly only to keep views written for the 14.0
module of the same name unchanged:

```xml
<field name="my_reference_field" widget="many2one_reference"/>
```
