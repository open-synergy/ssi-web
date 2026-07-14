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
