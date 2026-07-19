Add `widget="x2m_search"` to the one2many/many2many field that should get a
search box:

```xml
<field name="line_ids" widget="x2m_search">
    <list>
        <field name="name"/>
        <field name="qty"/>
    </list>
</field>
```

A search box appears inside the field's control panel. Typing a keyword
hides the rows (already loaded on the current page) whose visible columns
do not contain it; clearing the box shows every row again. New, unsaved
rows are always shown. The search box only appears for the list view mode
(`viewMode="list"`); it has no effect on kanban x2many.
