# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import _, fields, models

# Arch attributes naming a field of the view's own model. Both are
# registered on the name manager exactly like a <field> child, so the
# generic field-existence check already rejects an arch pointing at a field
# that does not exist, without any extra code in this module.
FIELD_ATTRIBUTES = [
    "child_field",
    "parent_field",
]


class IrUiView(models.Model):
    """
    Adds the ``hierarchy`` view type: a collapsible column tree that loads
    its children lazily, driven entirely by the ``child_field``/
    ``parent_field`` attributes of the arch rather than by a dedicated
    model.
    """

    _inherit = "ir.ui.view"

    type = fields.Selection(
        selection_add=[("hierarchy", "Hierarchy")],
        ondelete={"hierarchy": "cascade"},
    )

    def _postprocess_tag_hierarchy(self, node, name_manager, node_info):
        """Register the hierarchy tag's own attributes and validate its arch.

        ``child_field``/``parent_field`` name a field of the view's model,
        so both are registered on the name manager exactly like a
        ``<field>`` child: the generic field-existence check then rejects
        an arch that points at a field which does not exist, without any
        extra code here.

        :param node: the ``<hierarchy>`` arch element
        :param name_manager: the view's ``NameManager``
        :param node_info: postprocessing info for this node
        """
        for attribute in FIELD_ATTRIBUTES:
            value = node.get(attribute)
            if value:
                name_manager.has_field(value, {})

        if name_manager.validate:
            self._validate_hierarchy_fields(node, name_manager.Model)

        node_info["editable"] = False

    def _validate_hierarchy_fields(self, node, model):
        """Validate the ``child_field``/``parent_field`` attributes.

        At least one of the two attributes is required. ``parent_field``
        must be a ``many2one`` to the view's own model; ``child_field``
        must be a ``one2many`` or ``many2many`` to the view's own model. A
        field that does not exist at all is left to the generic name
        manager check, which already reports "Field ... does not exist".

        :param node: the ``<hierarchy>`` arch element
        :param model: the recordset of the view's model
        """
        child_field = node.get("child_field")
        parent_field = node.get("parent_field")

        if not child_field and not parent_field:
            error_message = _(
                """
Context: Validate hierarchy view architecture
Database ID: %s
Problem: Neither child_field nor parent_field is set on the hierarchy tag
Solution: Add child_field, parent_field, or both to the hierarchy tag
"""
                % (self.id,)
            )
            self.handle_view_error(error_message)

        if parent_field:
            self._validate_hierarchy_parent_field(parent_field, model)

        if child_field:
            self._validate_hierarchy_child_field(child_field, model)

    def _validate_hierarchy_parent_field(self, field_name, model):
        """Validate that ``parent_field`` is a many2one to the same model.

        Silently returns when the field does not exist at all: the generic
        name manager check already reports that case.

        :param field_name: value of the ``parent_field`` attribute
        :param model: the recordset of the view's model
        """
        field = model._fields.get(field_name)
        if not field:
            return

        if field.type != "many2one" or field.comodel_name != model._name:
            error_message = _(
                """
Context: Validate hierarchy view architecture
Database ID: %s
Problem: Attribute parent_field %s is not a many2one field of model %s
Solution: Set parent_field to a many2one field pointing to %s
"""
                % (self.id, field_name, model._name, model._name)
            )
            self.handle_view_error(error_message)

    def _validate_hierarchy_child_field(self, field_name, model):
        """Validate ``child_field`` is a one2many/many2many to the model.

        Silently returns when the field does not exist at all: the generic
        name manager check already reports that case.

        :param field_name: value of the ``child_field`` attribute
        :param model: the recordset of the view's model
        """
        field = model._fields.get(field_name)
        if not field:
            return

        if field.type not in ("one2many", "many2many") or (
            field.comodel_name != model._name
        ):
            error_message = _(
                """
Context: Validate hierarchy view architecture
Database ID: %s
Problem: Attribute child_field %s is not a one2many or many2many field of model %s
Solution: Set child_field to a one2many or many2many field pointing to %s
"""
                % (self.id, field_name, model._name, model._name)
            )
            self.handle_view_error(error_message)
