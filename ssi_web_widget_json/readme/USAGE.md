Apply the widget to any `text` or `char` field in a form or list view:

```xml
<field name="json_field" widget="json_viewer"/>
```

Features:

- **Read-only mode** — collapsible tree view with per-type value coloring
  (string, number, boolean, null) and item/key count summaries for
  collapsed nodes.
- **Edit mode** — monospace textarea with a live valid/invalid JSON
  indicator that updates on every keystroke.
- **Tab key** — pressing Tab inside the editor inserts 4 spaces of
  indentation instead of moving focus to the next field.
- **Fallback** — if the stored value is not valid JSON, it is shown as
  raw text (read-only) instead of raising an error.
