Adds a **search box** to the control panel of a one2many/many2many list
field, letting the user filter the rows that are already loaded on the
current page without leaving the form.

Ported from the 14.0 module of the same name. The 14.0 implementation
patched `FieldOne2Many` (`FieldOne2Many.include(X2mSearchMixin)`) and
`web.ControlPanelX2Many`, and searched the server through `web.rpc`. None of
those three things exist in Odoo 19: both field types are now rendered by a
single `X2ManyField` component (`@web/views/fields/x2many/x2many_field`),
the `web.ControlPanelX2Many` template is gone, and RPC calls go through the
`orm` service instead.

Because of that, this is a rewrite, not a port:

- A **new field widget**, `x2m_search`, is registered
  (`registry.category("fields").add("x2m_search", ...)`) as a subclass of
  `X2ManyField`. Unlike the 14.0 mixin, it does **not** attach itself to
  every x2many automatically — it only applies where the view opts in with
  `widget="x2m_search"`.
- Its template inherits `web.X2ManyField` in **primary** mode
  (`t-inherit-mode="primary"`), inserting the search box inside
  `.o_x2m_control_panel`.
- Filtering is **client-side only**, over the records the relational model
  (`StaticList`) has **already loaded** for the current page. Server-side
  search is not possible: `StaticList.load()` does not accept a `domain`
  parameter, so rows on other pages are not searched.
- Filtering never touches `StaticList` or its `_commands` — hiding a row
  only toggles a CSS class on its already-rendered `<tr>`. This is
  deliberate: filtering the record list itself would make hidden rows look
  deleted to the save logic. New, unsaved rows are always shown regardless
  of the search box content.
- Matching is a case-insensitive substring search over the formatted value
  of every visible, non-binary column.
