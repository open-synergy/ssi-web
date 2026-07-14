# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import _, fields, models

# Arch attributes naming a field of the view's own model. Every one of them has
# to be registered on the name manager, otherwise the field is absent from
# ``viewInfo.fields`` on the JavaScript side and the renderer cannot tell a
# ``date`` apart from a ``datetime``.
#
# The ``dependency_*`` attributes are deliberately absent: they name fields of
# the *link* model, not of the view's model, and registering them would make the
# view fail to install with "Field ... does not exist".
FIELD_ATTRIBUTES = [
    "date_start",
    "date_stop",
    "date_delay",
    "progress",
    "color",
    "dependency_field",
]

# Falsy spellings of a boolean arch attribute. Kept in step with ``toBool`` in
# static/src/js/gantt_view.js: the server and the browser have to agree on what
# event_open_popup="0" means.
FALSY_ATTRIBUTE_VALUES = ["", "0", "false", "False"]


def is_truthy(value):
    """Read a boolean arch attribute, which reaches us as a string or as None."""
    if value is None:
        return False
    return value not in FALSY_ATTRIBUTE_VALUES


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    type = fields.Selection(
        selection_add=[("ssi_gantt", "SSI Gantt")],
        ondelete={"ssi_gantt": "cascade"},
    )

    def _postprocess_tag_ssi_gantt(self, node, name_manager, node_info):
        for attribute in FIELD_ATTRIBUTES:
            value = node.get(attribute)
            if value:
                name_manager.has_field(value.split(".", 1)[0], {})

        for group_by in (node.get("default_group_by") or "").split(","):
            field_name = group_by.strip().split(":", 1)[0]
            if field_name:
                name_manager.has_field(field_name, {})

        if name_manager.validate:
            self._validate_ssi_gantt_dates(node)
            self._validate_ssi_gantt_form_view(node, name_manager.Model)

        # Outside the validate branch on purpose: the JavaScript side needs the
        # resolved id every time the arch is read, not only when it is checked.
        self._resolve_ssi_gantt_form_view(node)

        node_info["editable"] = False

    def _validate_ssi_gantt_dates(self, node):
        if not node.get("date_start"):
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attribute date_start is missing on the ssi_gantt tag
Solution: Add date_start to the ssi_gantt tag, pointing to a Date or Datetime field
"""
                % (self.id,)
            )
            self.handle_view_error(error_message)

        if not node.get("date_stop") and not node.get("date_delay"):
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attributes date_stop and date_delay are both missing on the ssi_gantt tag
Solution: Add either date_stop or date_delay to the ssi_gantt tag
"""
                % (self.id,)
            )
            self.handle_view_error(error_message)

    def _find_ssi_gantt_form_view(self, value):
        """Resolve the form_view_id attribute, given either as an XML id or as a
        database id, into an ir.ui.view record. Returns an empty recordset when
        the value points at nothing."""
        if value.isdigit():
            return self.browse(int(value)).exists()
        return self.env.ref(value, raise_if_not_found=False) or self.browse()

    def _validate_ssi_gantt_form_view(self, node, model):
        value = node.get("form_view_id")
        if not value:
            return

        # A form view is only ever opened from the popup, so naming one without
        # asking for the popup is a mistake the user has to be told about: the
        # attribute would otherwise be read by nothing at all.
        if not is_truthy(node.get("event_open_popup")):
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attribute form_view_id is set while event_open_popup is not enabled
Solution: Add event_open_popup="1" to the ssi_gantt tag, or remove form_view_id
"""
                % (self.id,)
            )
            self.handle_view_error(error_message)

        form_view = self._find_ssi_gantt_form_view(value)

        if not form_view:
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attribute form_view_id %s does not point to any view
Solution: Set form_view_id to the XML id of an existing form view of model %s
"""
                % (self.id, value, model._name)
            )
            self.handle_view_error(error_message)

        if form_view.type != "form":
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attribute form_view_id %s points to a %s view, not to a form view
Solution: Set form_view_id to the XML id of a form view of model %s
"""
                % (self.id, value, form_view.type, model._name)
            )
            self.handle_view_error(error_message)

        if form_view.model != model._name:
            error_message = _(
                """
Context: Validate ssi_gantt view architecture
Database ID: %s
Problem: Attribute form_view_id %s points to a form view of model %s
Solution: Set form_view_id to the XML id of a form view of model %s
"""
                % (self.id, value, form_view.model, model._name)
            )
            self.handle_view_error(error_message)

    def _resolve_ssi_gantt_form_view(self, node):
        """Rewrite form_view_id into a database id. The attribute is written as
        an XML id, because a database id cannot be known when a module ships the
        view, but the JavaScript side can only feed a number to FormViewDialog."""
        value = node.get("form_view_id")
        if not value or value.isdigit():
            return

        form_view = self._find_ssi_gantt_form_view(value)
        if form_view:
            node.set("form_view_id", str(form_view.id))
