Add an `ir.actions.act_window` whose `view_mode` lists `ssi_gantt`, then
create a matching `ir.ui.view` of type `ssi_gantt`:

```xml
<record id="my_model_view_ssi_gantt" model="ir.ui.view">
    <field name="name">my.model.ssi_gantt</field>
    <field name="model">my.model</field>
    <field name="arch" type="xml">
        <ssi_gantt
            date_start="date_start"
            date_stop="date_stop"
            default_group_by="user_id"
        />
    </field>
</record>
```

`date_stop` may be replaced by `date_delay` (a Float field expressing the
bar duration in hours).
