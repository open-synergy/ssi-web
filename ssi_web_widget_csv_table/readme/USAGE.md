Apply the widget to any `text` field in a form view:

```xml
<field name="csv_field" widget="csv_table"/>
```

Features:

- **Read-only mode** — the first row is treated as the table header; the
  remaining rows are paginated 50 rows per page, with navigation buttons
  when there is more than one page.
- **Edit mode** — two toggle buttons switch between a raw CSV textarea and
  a table view. In table view, each cell is directly editable (`TRUE`/
  `FALSE` cells render as a checkbox); edits are written back to the field
  as CSV.
- **Quoted fields** — CSV fields wrapped in double quotes (with escaped
  `""` and embedded commas or newlines) are parsed and re-serialized
  correctly.
- **Empty value** — an empty or line-less field renders an empty area
  instead of raising an error.
