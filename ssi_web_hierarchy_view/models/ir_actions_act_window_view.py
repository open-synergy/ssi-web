# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import fields, models


class IrActionsActWindowView(models.Model):
    """Adds the ``hierarchy`` view type to the action's ``view_mode``."""

    _inherit = "ir.actions.act_window.view"

    view_mode = fields.Selection(
        selection_add=[("hierarchy", "Hierarchy")],
        ondelete={"hierarchy": "cascade"},
    )
