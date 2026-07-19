Apply the widget to any `json` field in a form view and supply a JSON
Schema via the `schema` option:

```xml
<field
    name="json_data"
    widget="rjsf"
    options="{'schema': {'type': 'object',
                         'properties': {'name': {'type': 'string'},
                                        'age': {'type': 'integer'}}}}"
/>
```

Alternatively, read the schema from a sibling field via `schema_field`:

```xml
<field name="schema_char" invisible="1" />
<field name="json_data" widget="rjsf" options="{'schema_field': 'schema_char'}" />
```

Available options:

- `schema` (object) — static JSON Schema describing the form. Ignored
  when `schema_field` is set.
- `schema_field` (string) — name of a sibling field holding the JSON
  Schema. Takes priority over `schema`, and the form re-renders whenever
  that field's value changes.
- `uiSchema` (object, default `{}`) — RJSF uiSchema for UI customization.
- `liveValidate` (boolean, default `false`) — validate against the schema
  on every change.
- `omitExtraData` (boolean, default `false`) — strip keys not described in
  the schema on change.

Features:

- **Edit mode** — full RJSF form rendered from the resolved JSON Schema.
- **Read-only mode** — stored value displayed as a pretty-printed JSON
  block.
- **No schema** — a "no valid schema" message is shown instead of an
  error when neither `schema` nor `schema_field` resolves to a valid
  JSON Schema.
- **Self-contained** — bundles React 17, `@rjsf/core` 5, and
  `@rjsf/validator-ajv8` 5; no CDN dependency.
