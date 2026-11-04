Enable the behaviour per view with ``js_class="drag_scroll_list"``. It works on
standalone list views and on the inline tree of one2many/many2many fields::

    <tree js_class="drag_scroll_list">
        <field name="name" options="{'lock': True}"/>
        <field name="partner_id"/>
        ...
    </tree>

* Press the mouse button on an empty part of the list and move left or right to pan
  it horizontally. Vertical scrolling is not affected. A click
  after a drag does not open the record.
* Fields with ``options="{'lock': True}"`` are locked by default.
* Every field header shows a pin icon. Click it to lock or unlock that column; the
  choice is remembered in the browser.
* Locked columns are always shown side by side at the left edge of the list, in the
  order of the view, whatever the order they were locked in. Unlocking a column puts
  it back at its place in the view.
