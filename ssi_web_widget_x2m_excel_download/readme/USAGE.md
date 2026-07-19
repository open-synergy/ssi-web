No configuration is needed. Once the module is installed, every
one2many/many2many list shown inside a form view gets an **Excel
Download** button at the top of its control panel:

```xml
<field name="line_ids"/>
```

To disable the button for a specific field, add the `excel_download`
option:

```xml
<field name="line_ids" options="{'excel_download': 0}"/>
```
