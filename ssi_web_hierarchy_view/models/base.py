# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import _, models
from odoo.exceptions import UserError

# Maximum number of levels the parent chain is walked upwards. A chain
# longer than this is treated as cyclic data rather than as a legitimate
# hierarchy, so the walk raises instead of looping forever.
HIERARCHY_MAX_DEPTH = 64


class Base(models.AbstractModel):
    """
    Adds the server side of the hierarchy view's search mode to every
    model: one single call returns the records matching a domain together
    with their whole parent chain, so that the browser never has to walk
    that chain with one RPC per level.
    """

    _inherit = "base"

    def hierarchy_search_ancestors(self, domain, parent_field, limit=None):
        """Search ``domain`` and resolve the parent chain of every match.

        Called by the ``hierarchy`` view whenever a search view filter is
        active. A record matching the filter but buried deep inside the
        tree has to be shown together with every one of its ancestors,
        otherwise it stays invisible until the user happens to open the
        whole chain by hand.

        Access rights are honoured: there is no ``sudo()`` anywhere. An
        ancestor the current user may not read is dropped silently, and
        so is everything above it, which makes its child rise to the top
        level of the displayed tree.

        :param domain: search domain the records have to match
        :param parent_field: name of the ``many2one`` to this same model
            carrying the parent of a record
        :param limit: maximum number of matches, ``None`` for no limit
        :return: dict with ``matches`` (ids matching ``domain``, ordered
            by the model ``_order``), ``ancestors`` (ids of the ancestors
            of those matches that do not match ``domain`` themselves,
            closest level first) and ``truncated`` (``True`` when
            ``limit`` cut the matches short)
        :raises UserError: when ``parent_field`` is not a ``many2one``
            pointing at this model, or when the parent chain is deeper
            than ``HIERARCHY_MAX_DEPTH`` levels, which only happens on
            cyclic data
        """
        self._check_hierarchy_parent_field(parent_field)
        matches = self.search(domain, limit=limit)
        truncated = bool(limit) and self.search_count(domain) > limit
        return {
            "matches": matches.ids,
            "ancestors": self._hierarchy_ancestor_ids(matches, parent_field),
            "truncated": truncated,
        }

    def _check_hierarchy_parent_field(self, parent_field):
        """Reject a ``parent_field`` that cannot carry a parent chain.

        Extension point: override to accept another way of naming the
        parent of a record without touching
        ``hierarchy_search_ancestors`` itself.

        :param parent_field: value of the arch's ``parent_field``
        :raises UserError: when the field does not exist on this model,
            or is not a ``many2one`` pointing at this very model
        """
        field = self._fields.get(parent_field)
        if field is None:
            error_message = _(
                """
Context: Search a hierarchy view with a filter
Database ID: %s
Problem: Field %s does not exist on model %s
Solution: Set parent_field of the hierarchy tag to an existing field
"""
                % (self.id, parent_field, self._name)
            )
            raise UserError(error_message)

        if field.type != "many2one" or field.comodel_name != self._name:
            error_message = _(
                """
Context: Search a hierarchy view with a filter
Database ID: %s
Problem: Field %s is not a many2one field of model %s
Solution: Set parent_field to a many2one field pointing to %s
"""
                % (self.id, parent_field, self._name, self._name)
            )
            raise UserError(error_message)

    def _hierarchy_ancestor_ids(self, records, parent_field):
        """Walk ``parent_field`` upwards and collect the ancestors.

        The walk is breadth first, one level per iteration, so a whole
        level costs a single query no matter how many records it holds.
        Ancestors that also belong to ``records`` are left out of the
        result: the caller already reports those as matches. Ancestors
        the user may not read are dropped, because the lookup of each
        level goes through ``search`` and therefore through the record
        rules of the current user.

        :param records: the recordset the walk starts from
        :param parent_field: name of the ``many2one`` to this same model
        :return: list of ancestor ids, closest level first
        :raises UserError: when more than ``HIERARCHY_MAX_DEPTH`` levels
            are walked, which only happens on cyclic data
        """
        ancestor_ids = []
        seen_ids = set(records.ids)
        level = records
        depth = 0
        while level:
            parent_ids = set(level.mapped(parent_field).ids)
            if not parent_ids:
                break
            depth += 1
            if depth > HIERARCHY_MAX_DEPTH:
                self._raise_hierarchy_depth_error(parent_field)
            level = self.search([("id", "in", list(parent_ids))])
            for ancestor_id in level.ids:
                if ancestor_id in seen_ids:
                    continue
                seen_ids.add(ancestor_id)
                ancestor_ids.append(ancestor_id)
        return ancestor_ids

    def _raise_hierarchy_depth_error(self, parent_field):
        """Report a parent chain that never reaches a root record.

        :param parent_field: name of the ``many2one`` being walked
        :raises UserError: always
        """
        error_message = _(
            """
Context: Resolve the parent chain of a hierarchy view search
Database ID: %s
Problem: Field %s of model %s is nested deeper than %s levels
Solution: Break the parent loop in the data of model %s
"""
            % (
                self.id,
                parent_field,
                self._name,
                HIERARCHY_MAX_DEPTH,
                self._name,
            )
        )
        raise UserError(error_message)
