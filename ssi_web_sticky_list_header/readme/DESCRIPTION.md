Makes the header row (`<thead>`) of list views and x2many fields
(One2many / Many2many) sticky so it remains visible while scrolling
through long records.

Odoo 19 core already provides a native sticky header on desktop screens;
this module reinforces that behaviour explicitly (sticky positioning +
header background colour) so it keeps holding even if a theme module or
a future core change weakens the native rule.
