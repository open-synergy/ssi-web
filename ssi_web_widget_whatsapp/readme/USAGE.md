Apply the widget to any `char` field storing a phone number:

```xml
<field name="mobile" widget="whatsapp_message"/>
```

The stored value should be in international format (e.g. `+628123456789`
or `628123456789`). Non-numeric characters such as spaces, dashes,
parentheses and the leading `+` are stripped automatically before building
the WhatsApp URL.

The widget only renders something in readonly mode with a non-empty value.
To keep the field editable, show it a second time without the widget (or
with another widget), for example:

```xml
<field name="mobile"/>
<field name="mobile" widget="whatsapp_message"/>
```
