# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import _, fields, models
from odoo.tools.view_validation import get_variable_names

# Arch attributes naming a field of the view's own model. Both are
# registered on the name manager exactly like a <field> child, so the
# generic field-existence check already rejects an arch pointing at a field
# that does not exist, without any extra code in this module.
FIELD_ATTRIBUTES = [
    "child_field",
    "parent_field",
]

# Prefix of the row decoration attributes, the same one a list view uses.
DECORATION_PREFIX = "decoration-"

# Decoration suffixes the hierarchy tag accepts, exactly the ones
# ssi_web_gantt accepts. The order is the order the row classes are applied
# in, so a suffix listed later wins over an earlier one whenever several
# decorations light up on the same row.
DECORATION_SUFFIXES = [
    "danger",
    "warning",
    "info",
    "success",
    "primary",
    "secondary",
    "muted",
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
        extra code here. The fields read by a ``decoration-*`` expression
        are registered the same way, so that they are fetched by the
        browser even when they are no column of the tree.

        :param node: the ``<hierarchy>`` arch element
        :param name_manager: the view's ``NameManager``
        :param node_info: postprocessing info for this node
        """
        for attribute in FIELD_ATTRIBUTES:
            value = node.get(attribute)
            if value:
                name_manager.has_field(value, {})

        self._register_hierarchy_decoration_fields(node, name_manager)

        if name_manager.validate:
            self._validate_hierarchy_fields(node, name_manager.Model)
            self._validate_hierarchy_decorations(node)

        node_info["editable"] = False

    def _hierarchy_decorations(self, node):
        """Return the ``decoration-*`` attributes of the hierarchy tag.

        :param node: the ``<hierarchy>`` arch element
        :return: list of ``(suffix, expression)`` tuples, in arch order,
            the suffix being whatever follows ``decoration-`` and not
            necessarily a supported one
        """
        decorations = []
        for attribute, expression in node.items():
            if attribute.startswith(DECORATION_PREFIX):
                suffix = attribute[len(DECORATION_PREFIX) :]
                decorations.append((suffix, expression))
        return decorations

    def _register_hierarchy_decoration_fields(self, node, name_manager):
        """Register every field read by a ``decoration-*`` expression.

        A field only used by a decoration expression is no column of the
        tree, so nothing else declares it. Registering it here serves two
        purposes at once: the generic attribute validation of
        ``ir.ui.view`` requires every name a ``decoration-*`` expression
        reads to be a field available in the view, and
        ``fields_view_get`` reports exactly the registered fields, which
        is what the browser fetches.

        An expression that is not valid Python is skipped silently here
        and reported by :meth:`_validate_hierarchy_decorations`, the only
        place that is allowed to raise.

        :param node: the ``<hierarchy>`` arch element
        :param name_manager: the view's ``NameManager``
        """
        for suffix, expression in self._hierarchy_decorations(node):
            if suffix not in DECORATION_SUFFIXES:
                continue
            for field_name in self._hierarchy_decoration_field_names(expression):
                name_manager.has_field(field_name, {})

    def _hierarchy_decoration_field_names(self, expression):
        """Return the field names a decoration expression reads.

        Symbols of the evaluation context itself (``uid``, ``context``,
        ``datetime``, ...) are left out by the very same helper the list
        view relies on. A dotted name is left out too: it is no field of
        the model, and the generic attribute validation already rejects
        it as a composed field.

        :param expression: value of a ``decoration-*`` attribute
        :return: sorted list of field names, empty when the expression is
            not valid Python
        """
        try:
            names = get_variable_names(expression)
        except SyntaxError:
            return []
        return sorted(name for name in names if "." not in name)

    def _validate_hierarchy_decorations(self, node):
        """Validate the ``decoration-*`` attributes of the hierarchy tag.

        Only the suffixes of ``DECORATION_SUFFIXES`` are accepted, and
        the expression of each of them has to be valid Python. An unknown
        suffix is a typo that would otherwise colour nothing at all, and
        a broken expression would only ever fail in the browser, long
        after the view was saved.

        Which fields an expression may read is not checked here: the
        generic attribute validation of ``ir.ui.view`` already requires
        every name it reads to be a field available in the view.

        :param node: the ``<hierarchy>`` arch element
        """
        for suffix, expression in self._hierarchy_decorations(node):
            if suffix not in DECORATION_SUFFIXES:
                self._raise_hierarchy_decoration_suffix_error(suffix)
            self._validate_hierarchy_decoration_expression(suffix, expression)

    def _validate_hierarchy_decoration_expression(self, suffix, expression):
        """Reject a decoration expression that is not valid Python.

        :param suffix: the supported suffix the expression belongs to
        :param expression: value of the ``decoration-*`` attribute
        """
        try:
            get_variable_names(expression)
        except SyntaxError:
            error_message = _(
                """
Context: Validate hierarchy view architecture
Database ID: %s
Problem: Attribute decoration-%s is not a valid Python expression: %s
Solution: Write the value of decoration-%s as a Python expression
"""
                % (self.id, suffix, expression, suffix)
            )
            self.handle_view_error(error_message)

    def _raise_hierarchy_decoration_suffix_error(self, suffix):
        """Reject a ``decoration-*`` attribute with an unsupported suffix.

        :param suffix: whatever followed ``decoration-`` in the arch
        """
        error_message = _(
            """
Context: Validate hierarchy view architecture
Database ID: %s
Problem: Attribute decoration-%s is not a supported row decoration
Solution: Use one of the supported decorations: %s
"""
            % (self.id, suffix, ", ".join(DECORATION_SUFFIXES))
        )
        self.handle_view_error(error_message)

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
