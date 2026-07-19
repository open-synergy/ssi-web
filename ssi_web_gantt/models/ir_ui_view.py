# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import fields, models

# Arch attributes naming a date field of the view's own model. Every one of
# them has to be registered on the name manager, otherwise the field is
# absent from ``viewInfo.fields`` on the JavaScript side and the renderer
# cannot read it from the record data.
DATE_ATTRIBUTES = ["date_start", "date_stop", "date_delay"]


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    type = fields.Selection(
        selection_add=[("ssi_gantt", "SSI Gantt")],
        ondelete={"ssi_gantt": "cascade"},
    )

    def _get_view_info(self):
        # Without this override, the "ssi_gantt" view type has no
        # display_name/icon, and any act_window whose view_mode lists it
        # raises "View types not defined" when the web client resolves the
        # available view types for the action.
        return {"ssi_gantt": {"icon": "fa fa-tasks"}} | super()._get_view_info()

    def _register_ssi_gantt_fields(self, node, name_manager, node_info):
        """Register every field named by the ssi_gantt tag's attributes on
        the name manager. Called from both the postprocess and the validate
        tree-walk (they use independent NameManager instances), mirroring
        how ``_postprocess_tag_calendar``/``_validate_tag_calendar`` do it in
        ``base``: without this, the "field does not exist" check performed by
        ``NameManager.check()`` never runs for this view type."""
        for attribute in DATE_ATTRIBUTES:
            fname = node.get(attribute)
            if fname:
                name_manager.has_field(node, fname, node_info)

        for group_by in (node.get("default_group_by") or "").split(","):
            fname = group_by.strip().split(":", 1)[0]
            if fname:
                name_manager.has_field(node, fname, node_info)

    def _postprocess_tag_ssi_gantt(self, node, name_manager, node_info):
        self._register_ssi_gantt_fields(node, name_manager, node_info)
        # The gantt view only ever reads field values, it never lets the
        # user edit them inline.
        node_info["editable"] = False

    def _validate_tag_ssi_gantt(self, node, name_manager, node_info):
        self._register_ssi_gantt_fields(node, name_manager, node_info)

        if not node_info["validate"]:
            return

        if not node.get("date_start"):
            msg = self.env._(
                "Context: Validate ssi_gantt view architecture\n"
                "Problem: Attribute date_start is missing on the ssi_gantt tag\n"
                "Solution: Add date_start to the ssi_gantt tag, pointing to a "
                "Date or Datetime field"
            )
            self._raise_view_error(msg, node)

        if not node.get("date_stop") and not node.get("date_delay"):
            msg = self.env._(
                "Context: Validate ssi_gantt view architecture\n"
                "Problem: Attributes date_stop and date_delay are both "
                "missing on the ssi_gantt tag\n"
                "Solution: Add either date_stop or date_delay to the "
                "ssi_gantt tag"
            )
            self._raise_view_error(msg, node)
