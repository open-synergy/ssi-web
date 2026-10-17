On any ``Text`` field, set the mode through the widget options::

    <field name="body" widget="ace" options="{'mode': 'markdown'}"/>
    <field name="payload" widget="ace" options="{'mode': 'json'}"/>

Other modules that use Ace outside a field widget can load the same
libraries without writing any file path::

    ajax.loadLibs({jsLibs: AceEditor.prototype.jsLibs});
