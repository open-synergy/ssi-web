# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import _, models
from odoo.exceptions import UserError

# Maximum number of levels the parent chain is walked upwards. A chain
# longer than this is treated as cyclic data rather than as a legitimate
# hierarchy, so the walk raises instead of looping forever.
HIERARCHY_MAX_DEPTH = 64

# Field types a subtree total may be computed for, exactly the ones a list
# view aggregates with its own ``sum=``. The total of anything else is
# meaningless, and a field that is not stored cannot be queried at all.
HIERARCHY_AGGREGATABLE_TYPES = [
    "integer",
    "float",
    "monetary",
]


class Base(models.AbstractModel):
    """
    Adds the server side of the hierarchy view to every model: one single
    call returns the records matching a domain together with their whole
    parent chain, so that the browser never has to walk that chain with
    one RPC per level, and one single call returns the subtree total of a
    numeric column for a whole level of nodes at once.
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

    def hierarchy_aggregate(
        self, node_ids, field_names, parent_field=None, child_field=None
    ):
        """Return the subtree total of every field for every given node.

        Called by the ``hierarchy`` view once per level, for every id of
        that level at once rather than once per node, so that opening a
        node costs one query per level of its subtree instead of one
        query per descendant.

        The total reported for a node **includes the value of the node
        itself**: that is what the reader of a chart of accounts expects,
        and it keeps the total of a parent equal to the sum of the column
        as it is displayed underneath it.

        Descendants are walked through ``parent_field`` when it is given
        and through ``child_field`` otherwise. ``child_of`` is
        deliberately not used: it requires the walked field to be the
        ``_parent_name`` of the model, which nothing guarantees here.

        Access rights are honoured — there is no ``sudo()`` anywhere — so
        a descendant the current user may not read is left out of the
        total, consistently with the rows that user sees in the tree.

        :param node_ids: ids of the nodes a total is asked for
        :param field_names: names of the numeric stored fields to total
        :param parent_field: name of the ``many2one`` to this same model
            carrying the parent of a record, ``None`` to walk
            ``child_field`` instead
        :param child_field: name of the ``one2many``/``many2many`` to
            this same model carrying the children of a record, used only
            when ``parent_field`` is not given
        :return: dict ``{node_id: {field_name: total}}`` holding one
            entry for every id of ``node_ids``
        :raises UserError: when a field of ``field_names`` does not
            exist, is not numeric or is not stored, when neither
            ``parent_field`` nor ``child_field`` is given, or when the
            tree is nested deeper than ``HIERARCHY_MAX_DEPTH`` levels,
            which only happens on cyclic data
        """
        self._check_hierarchy_aggregate_fields(field_names)
        self._check_hierarchy_walk_fields(parent_field, child_field)
        subtree_ids = self._hierarchy_subtree_ids(node_ids, parent_field, child_field)
        values = self._hierarchy_aggregate_values(subtree_ids, field_names)
        totals = {}
        for node_id, record_ids in subtree_ids.items():
            totals[node_id] = {
                field_name: sum(
                    values[record_id].get(field_name) or 0
                    for record_id in record_ids
                    if record_id in values
                )
                for field_name in field_names
            }
        return totals

    def _check_hierarchy_aggregate_fields(self, field_names):
        """Reject a field that carries no summable stored value.

        Extension point: override to accept another kind of column
        without touching :meth:`hierarchy_aggregate` itself.

        :param field_names: names of the fields to total
        :raises UserError: when a field does not exist on this model, is
            of a type outside ``HIERARCHY_AGGREGATABLE_TYPES``, or is not
            stored and can therefore not be queried
        """
        for field_name in field_names:
            field = self._fields.get(field_name)
            if field is None:
                error_message = _(
                    """
Context: Aggregate a hierarchy view column
Database ID: %s
Problem: Field %s does not exist on model %s
Solution: Set sum on a field that exists on model %s
"""
                    % (self.id, field_name, self._name, self._name)
                )
                raise UserError(error_message)

            if field.type not in HIERARCHY_AGGREGATABLE_TYPES:
                error_message = _(
                    """
Context: Aggregate a hierarchy view column
Database ID: %s
Problem: Field %s of model %s is not a numeric field
Solution: Set sum on a field of type %s
"""
                    % (
                        self.id,
                        field_name,
                        self._name,
                        ", ".join(HIERARCHY_AGGREGATABLE_TYPES),
                    )
                )
                raise UserError(error_message)

            if not field.store:
                error_message = _(
                    """
Context: Aggregate a hierarchy view column
Database ID: %s
Problem: Field %s of model %s is not stored
Solution: Set sum on a stored field, a total is queried server side
"""
                    % (self.id, field_name, self._name)
                )
                raise UserError(error_message)

    def _check_hierarchy_walk_fields(self, parent_field, child_field):
        """Reject an aggregation that cannot walk the tree downwards.

        :param parent_field: value of the arch's ``parent_field``
        :param child_field: value of the arch's ``child_field``
        :raises UserError: when neither of the two is given, leaving no
            way at all to reach the descendants of a node
        """
        if parent_field or child_field:
            return

        error_message = _(
            """
Context: Aggregate a hierarchy view column
Database ID: %s
Problem: Neither parent_field nor child_field was given for model %s
Solution: Add parent_field, child_field, or both to the hierarchy tag
"""
            % (self.id, self._name)
        )
        raise UserError(error_message)

    def _hierarchy_subtree_ids(self, node_ids, parent_field, child_field):
        """Walk the tree downwards and collect the subtree of each node.

        The walk is breadth first, one level per iteration, so a whole
        level costs a single query no matter how many nodes it holds. A
        record is only ever counted once per subtree, so a node reachable
        through two different parents of one and the same subtree is not
        summed twice.

        :param node_ids: ids of the nodes a subtree is asked for
        :param parent_field: name of the ``many2one`` to this same model,
            or ``None``
        :param child_field: name of the ``one2many``/``many2many`` to
            this same model, used when ``parent_field`` is ``None``
        :return: dict ``{node_id: set of ids}``, every set holding the
            node itself besides its descendants
        :raises UserError: when more than ``HIERARCHY_MAX_DEPTH`` levels
            are walked, which only happens on cyclic data
        """
        subtree_ids = {node_id: {node_id} for node_id in node_ids}
        # Ids of the level being walked, mapped to the requested nodes
        # whose subtree they belong to. One id may well belong to several
        # of them at once, whenever a node and its own ancestor are both
        # part of ``node_ids``.
        level = {node_id: {node_id} for node_id in node_ids}
        depth = 0
        while level:
            children_ids = self._hierarchy_children_ids(
                sorted(level), parent_field, child_field
            )
            next_level = {}
            for parent_id, child_ids in children_ids.items():
                for child_id in child_ids:
                    owner_ids = next_level.setdefault(child_id, set())
                    owner_ids.update(level[parent_id])
            if not next_level:
                break
            depth += 1
            if depth > HIERARCHY_MAX_DEPTH:
                self._raise_hierarchy_aggregate_depth_error()
            for child_id, owner_ids in next_level.items():
                for owner_id in owner_ids:
                    subtree_ids[owner_id].add(child_id)
            level = next_level
        return subtree_ids

    def _hierarchy_children_ids(self, node_ids, parent_field, child_field):
        """Read the children of a whole level in one single query.

        ``parent_field`` is preferred whenever it is given: searching on
        it already leaves out the records the current user may not read,
        whereas the ids carried by ``child_field`` would have to be
        filtered afterwards.

        :param node_ids: ids of the level the children are read for
        :param parent_field: name of the ``many2one`` to this same model,
            or ``None``
        :param child_field: name of the ``one2many``/``many2many`` to
            this same model, used when ``parent_field`` is ``None``
        :return: dict ``{node_id: list of child ids}``, holding no entry
            at all for a node without children
        """
        children_ids = {}
        if parent_field:
            for record in self.search_read(
                [(parent_field, "in", node_ids)], [parent_field]
            ):
                parent_value = record[parent_field]
                parent_id = parent_value[0] if parent_value else False
                if parent_id:
                    children_ids.setdefault(parent_id, []).append(record["id"])
            return children_ids

        for record in self.search_read([("id", "in", node_ids)], [child_field]):
            if record[child_field]:
                children_ids[record["id"]] = list(record[child_field])
        return children_ids

    def _hierarchy_aggregate_values(self, subtree_ids, field_names):
        """Read the values every subtree total is built from.

        One single query for the union of every subtree: a record belongs
        to the subtree of each one of its ancestors, so reading node by
        node would read that record over and over again.

        The read goes through ``search_read`` and therefore through the
        record rules of the current user, which is what keeps a
        descendant that user may not read out of the totals.

        :param subtree_ids: dict ``{node_id: set of ids}`` as returned by
            :meth:`_hierarchy_subtree_ids`
        :param field_names: names of the numeric fields to read
        :return: dict ``{record_id: {field_name: value}}``, holding no
            entry for a record the current user may not read
        """
        all_ids = set()
        for record_ids in subtree_ids.values():
            all_ids.update(record_ids)
        if not all_ids:
            return {}

        values = {}
        for record in self.search_read(
            [("id", "in", sorted(all_ids))], list(field_names)
        ):
            values[record["id"]] = record
        return values

    def _raise_hierarchy_aggregate_depth_error(self):
        """Report a subtree walk that never reaches a leaf record.

        :raises UserError: always
        """
        error_message = _(
            """
Context: Aggregate a hierarchy view column
Database ID: %s
Problem: Model %s is nested deeper than %s levels
Solution: Break the parent loop in the data of model %s
"""
            % (self.id, self._name, HIERARCHY_MAX_DEPTH, self._name)
        )
        raise UserError(error_message)
