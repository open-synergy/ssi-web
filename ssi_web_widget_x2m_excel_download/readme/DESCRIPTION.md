Adds an **Excel Download** button to the control panel of every
one2many/many2many list rendered inside a form view, without requiring any
`widget=` attribute or arch change.

Clicking the button exports **every linked record** — not just the page
currently displayed — to a `.xlsx` file, using the columns and labels shown
in the list.

Ported from the 14.0 module of the same name. The 14.0 implementation
patched `FieldOne2Many`/`FieldMany2Many` (`web.relational_fields`); those
classes no longer exist in Odoo 19, where both field types are rendered by
a single `X2ManyField` component
(`@web/views/fields/x2many/x2many_field`). The button is added by patching
that component's prototype and extending its template
(`web.X2ManyField`) — no new field widget is registered, so the button
keeps appearing automatically everywhere, exactly as in 14.0.

The `.xlsx` file itself is still built by a small hand-written writer
(`xlsx_writer.esm.js`, a straight ESM port of the 14.0 `xlsx_writer.js`)
that needs no external library. The 14.0 `xlsx.full.min.js` stub (already
unused, marked "No longer used") is not carried over.

**Opting a field out**

Add `options="{'excel_download': 0}"` to the `<field>` node to hide the
button for that field only:

```xml
<field name="line_ids" options="{'excel_download': 0}"/>
```
