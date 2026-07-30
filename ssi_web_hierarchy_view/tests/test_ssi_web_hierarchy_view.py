# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from unittest import mock

from odoo_yaml_test import YamlTransactionCase

from odoo.exceptions import UserError
from odoo.tests import tagged

# Name of the custom model the monetary scenarios are run on. No model of
# ``base`` carries a ``monetary`` field at all, and this module depends on
# ``base``/``web`` only, so amounts in several currencies can only be
# totalled on a model declared by the test itself.
CURRENCY_MODEL = "x_ssiwhv_amount"


@tagged("post_install", "-at_install")
class TestSsiWebHierarchyView(YamlTransactionCase):
    """Covers the ``hierarchy`` view arch validation, search and totals.

    The arch validation scenarios live in the YAML file; the hierarchical
    search, the subtree totals, the grand total and the currencies those
    totals are made of are asserted here because what is under test is
    the value ``hierarchy_search_ancestors``, ``hierarchy_aggregate`` and
    ``hierarchy_grand_total`` return.
    """

    def _create_partner_chain(self, prefix):
        """Create a three level ``res.partner`` chain.

        :param prefix: prefix made unique per test, so that the domains
            of one test never match the records of another
        :return: tuple of the grandparent, the parent and the child
        """
        partner_model = self.env["res.partner"]
        grandparent = partner_model.create({"name": "%s Grandparent" % prefix})
        parent = partner_model.create(
            {"name": "%s Parent" % prefix, "parent_id": grandparent.id}
        )
        child = partner_model.create(
            {"name": "%s Child" % prefix, "parent_id": parent.id}
        )
        return grandparent, parent, child

    def _create_partner_amount_chain(self, prefix):
        """Create a three level ``res.partner`` chain carrying amounts.

        ``color`` is an integer and ``partner_latitude`` a float, both
        stored on ``res.partner`` by ``base`` itself, so the totals can
        be asserted without depending on any other module being
        installed. Neither of them is a commercial field, unlike
        ``credit_limit``: Odoo copies a commercial field from the
        commercial partner down to its children, which would give every
        row of the chain one and the same value.

        :param prefix: prefix made unique per test, so that the domains
            of one test never match the records of another
        :return: tuple of the grandparent, the parent and the child
        """
        partner_model = self.env["res.partner"]
        grandparent = partner_model.create(
            {
                "name": "%s Grandparent" % prefix,
                "color": 1,
                "partner_latitude": 10.5,
            }
        )
        parent = partner_model.create(
            {
                "name": "%s Parent" % prefix,
                "parent_id": grandparent.id,
                "color": 2,
                "partner_latitude": 20.25,
            }
        )
        child = partner_model.create(
            {
                "name": "%s Child" % prefix,
                "parent_id": parent.id,
                "color": 4,
                "partner_latitude": 30.125,
            }
        )
        return grandparent, parent, child

    def _create_currency_model(self):
        """Declare a custom model carrying a monetary hierarchy.

        A model of its own is declared rather than custom fields added
        to ``res.partner``: a brand new model carries no ``currency_id``
        of any kind, so ``fields.Monetary`` can only resolve its
        currency to the ``x_currency_id`` created here, whatever other
        module happens to be installed next to this one.

        The registry is restored afterwards, so the model never leaks
        into another test.

        Pure Python fixture — trigger P10 (L-09/L-10: the fixture has to
        change the registry and register a cleanup restoring it, which
        no YAML step can express).

        :return: the name of the model that was created
        """
        self.addCleanup(self.env.registry.reset_changes)
        model = self.env["ir.model"].create(
            {
                "name": "SSIWHV Amount Node",
                "model": CURRENCY_MODEL,
                "field_id": [
                    (
                        0,
                        0,
                        {
                            "name": "x_name",
                            "ttype": "char",
                            "field_description": "Name",
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "name": "x_color",
                            "ttype": "integer",
                            "field_description": "Color",
                        },
                    ),
                    (
                        0,
                        0,
                        {
                            "name": "x_currency_id",
                            "ttype": "many2one",
                            "relation": "res.currency",
                            "field_description": "Currency",
                        },
                    ),
                ],
            }
        )
        field_model = self.env["ir.model.fields"]
        # Both fields are added after the model itself: the parent points
        # at the model, and the monetary field can only pick up
        # x_currency_id once that field is part of the model.
        field_model.create(
            {
                "name": "x_parent_id",
                "model_id": model.id,
                "ttype": "many2one",
                "relation": CURRENCY_MODEL,
                "field_description": "Parent",
            }
        )
        field_model.create(
            {
                "name": "x_amount",
                "model_id": model.id,
                "ttype": "monetary",
                "field_description": "Amount",
            }
        )
        return CURRENCY_MODEL

    def _create_amount_chain(self, currencies, amounts):
        """Create a three level chain of monetary nodes.

        :param currencies: the three currencies, the deepest node last
        :param amounts: the three amounts, the deepest node last
        :return: tuple of the grandparent, the parent and the child
        """
        node_model = self.env[CURRENCY_MODEL]
        grandparent = node_model.create(
            {
                "x_name": "SSIWHV Amount Grandparent",
                "x_color": 1,
                "x_currency_id": currencies[0].id,
                "x_amount": amounts[0],
            }
        )
        parent = node_model.create(
            {
                "x_name": "SSIWHV Amount Parent",
                "x_parent_id": grandparent.id,
                "x_color": 2,
                "x_currency_id": currencies[1].id,
                "x_amount": amounts[1],
            }
        )
        child = node_model.create(
            {
                "x_name": "SSIWHV Amount Child",
                "x_parent_id": parent.id,
                "x_color": 4,
                "x_currency_id": currencies[2].id,
                "x_amount": amounts[2],
            }
        )
        return grandparent, parent, child

    def _create_hierarchy_view(self, name, arch):
        """Create a ``hierarchy`` view on ``res.partner``.

        :param name: name of the view, unique per test
        :param arch: the arch of the view
        :return: the created ``ir.ui.view`` record
        """
        return self.env["ir.ui.view"].create(
            {
                "name": name,
                "model": "res.partner",
                "type": "hierarchy",
                "arch": arch,
            }
        )

    def test_ssi_web_hierarchy_view(self):
        """Run the ``hierarchy`` view type arch validation scenarios."""
        self.run_yaml_scenario("test_data_ssi_web_hierarchy_view.yaml")

    def test_decoration_field_is_reported_to_the_browser(self):
        """Assert a decoration-only field is reported by the view.

        A field read by a ``decoration-*`` expression is usually no
        column of the tree, so nothing else declares it; the browser only
        fetches the fields the view reports, hence it has to be reported
        even though no ``<field>`` names it.

        Pure Python — trigger P1 (L-01: what is under test is the dict
        ``fields_view_get`` returns, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        view = self._create_hierarchy_view(
            "SSIWHV Decoration Field Reported",
            """
            <hierarchy parent_field="parent_id" decoration-danger="not active">
                <field name="name" />
            </hierarchy>
            """,
        )
        result = self.env["res.partner"].fields_view_get(
            view_id=view.id, view_type="hierarchy"
        )
        self.assertIn("active", result["fields"])
        self.assertIn("name", result["fields"])
        self.assertIn("parent_id", result["fields"])

    def test_every_field_of_a_decoration_is_reported(self):
        """Assert an expression reading several fields reports them all.

        A field never named by any ``<field>`` and a field only named by
        another decoration have to be reported just the same, otherwise
        the expression would be evaluated against a value the browser
        never fetched.

        Pure Python — trigger P1 (L-01: what is under test is the dict
        ``fields_view_get`` returns, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        view = self._create_hierarchy_view(
            "SSIWHV Decoration Fields Reported",
            """
            <hierarchy
                parent_field="parent_id"
                decoration-warning="is_company and color == 1"
                decoration-muted="employee"
            >
                <field name="name" />
            </hierarchy>
            """,
        )
        result = self.env["res.partner"].fields_view_get(
            view_id=view.id, view_type="hierarchy"
        )
        self.assertIn("is_company", result["fields"])
        self.assertIn("color", result["fields"])
        self.assertIn("employee", result["fields"])

    def test_search_ancestors_of_a_grandchild(self):
        """Assert the parent chain returned for a deep match.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        grandparent, parent, child = self._create_partner_chain("SSIWHV Deep")
        result = self.env["res.partner"].hierarchy_search_ancestors(
            [("name", "=", "SSIWHV Deep Child")], "parent_id"
        )
        self.assertEqual(result["matches"], [child.id])
        self.assertEqual(set(result["ancestors"]), {parent.id, grandparent.id})
        self.assertFalse(result["truncated"])

    def test_search_ancestors_are_not_duplicated(self):
        """Assert two sibling matches share their ancestors only once.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, so YAML cannot see the list at all).
        """
        grandparent, parent, child = self._create_partner_chain("SSIWHV Sibling")
        sibling = self.env["res.partner"].create(
            {"name": "SSIWHV Sibling Child Two", "parent_id": parent.id}
        )
        result = self.env["res.partner"].hierarchy_search_ancestors(
            [("name", "like", "SSIWHV Sibling Child")], "parent_id"
        )
        self.assertEqual(set(result["matches"]), {child.id, sibling.id})
        self.assertEqual(set(result["ancestors"]), {parent.id, grandparent.id})
        self.assertEqual(len(result["ancestors"]), 2)

    def test_search_ancestors_of_a_root_match(self):
        """Assert a match without any parent reports no ancestor.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, so the empty list cannot be asserted
        in YAML).
        """
        root = self.env["res.partner"].create({"name": "SSIWHV Root Only"})
        result = self.env["res.partner"].hierarchy_search_ancestors(
            [("name", "=", "SSIWHV Root Only")], "parent_id"
        )
        self.assertEqual(result["matches"], [root.id])
        self.assertEqual(result["ancestors"], [])

    def test_search_ancestors_reports_a_truncated_result(self):
        """Assert ``truncated`` follows the ``limit`` given by the view.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, so the flag cannot be asserted in
        YAML).
        """
        self._create_partner_chain("SSIWHV Limit")
        partner_model = self.env["res.partner"]
        result = partner_model.hierarchy_search_ancestors(
            [("name", "like", "SSIWHV Limit")], "parent_id", limit=2
        )
        self.assertEqual(len(result["matches"]), 2)
        self.assertTrue(result["truncated"])

        result = partner_model.hierarchy_search_ancestors(
            [("name", "like", "SSIWHV Limit")], "parent_id", limit=5
        )
        self.assertEqual(len(result["matches"]), 3)
        self.assertFalse(result["truncated"])

    def test_search_ancestors_rejects_an_unknown_parent_field(self):
        """Reject a ``parent_field`` naming a field that does not exist.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_search_ancestors(
                [], "no_such_field_at_all"
            )
        self.assertIn("no_such_field_at_all", str(error.exception))
        self.assertIn("does not exist", str(error.exception))

    def test_search_ancestors_rejects_a_parent_field_that_is_not_m2o(self):
        """Reject a ``parent_field`` that is not a many2one to the model.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_search_ancestors([], "name")
        self.assertIn("is not a many2one field", str(error.exception))

    def test_search_ancestors_rejects_cyclic_data(self):
        """Reject a parent chain that never reaches a root record.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value) combined with the raw SQL needed to produce the
        cycle: ``res.partner._check_parent_id`` makes a cycle
        unwritable through the ORM, and YAML has no way to bypass a
        constraint (L-02).
        """
        root = self.env["res.partner"].create({"name": "SSIWHV Cycle Root"})
        child = self.env["res.partner"].create(
            {"name": "SSIWHV Cycle Child", "parent_id": root.id}
        )
        self.env["res.partner"].flush()
        self.env.cr.execute(
            "UPDATE res_partner SET parent_id = %s WHERE id = %s",
            (child.id, root.id),
        )
        self.env["res.partner"].invalidate_cache()
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_search_ancestors(
                [("id", "=", child.id)], "parent_id"
            )
        self.assertIn("nested deeper than 64 levels", str(error.exception))

    def test_aggregate_totals_the_whole_subtree(self):
        """Assert a grandparent total covers its children and grandchildren.

        The total of a parent has to include the value of the parent
        itself, otherwise it no longer equals the sum of the column as it
        is displayed underneath it.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        grandparent, parent, child = self._create_partner_amount_chain(
            "SSIWHV Aggregate"
        )
        totals = self.env["res.partner"].hierarchy_aggregate(
            [grandparent.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        self.assertEqual(totals[grandparent.id]["color"], 7)
        self.assertAlmostEqual(
            totals[grandparent.id]["partner_latitude"], 60.875, places=3
        )
        self.assertNotIn(parent.id, totals)
        self.assertNotIn(child.id, totals)

    def test_aggregate_of_a_leaf_is_its_own_value(self):
        """Assert a leaf reports the value it carries itself.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method) and trigger P2 (L-04: there is no float
        tolerance in YAML).
        """
        child = self._create_partner_amount_chain("SSIWHV Aggregate Leaf")[2]
        totals = self.env["res.partner"].hierarchy_aggregate(
            [child.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        self.assertEqual(totals[child.id]["color"], 4)
        self.assertAlmostEqual(totals[child.id]["partner_latitude"], 30.125, places=3)

    def test_aggregate_answers_every_id_of_one_call(self):
        """Assert one call covers a whole level rather than one node.

        The view aggregates a level in a single call, so every id handed
        over has to come back with its own total.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        grandparent, parent, child = self._create_partner_amount_chain(
            "SSIWHV Aggregate Batch"
        )
        totals = self.env["res.partner"].hierarchy_aggregate(
            [grandparent.id, parent.id, child.id],
            ["color"],
            parent_field="parent_id",
        )
        self.assertEqual(set(totals), {grandparent.id, parent.id, child.id})
        self.assertEqual(totals[grandparent.id]["color"], 7)
        self.assertEqual(totals[parent.id]["color"], 6)
        self.assertEqual(totals[child.id]["color"], 4)

    def test_aggregate_by_parent_field_and_by_child_field_match(self):
        """Assert both ways of walking the tree report the same totals.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method) and trigger P2 (L-04: there is no float
        tolerance in YAML).
        """
        grandparent = self._create_partner_amount_chain("SSIWHV Aggregate Both")[0]
        partner_model = self.env["res.partner"]
        by_parent = partner_model.hierarchy_aggregate(
            [grandparent.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        by_child = partner_model.hierarchy_aggregate(
            [grandparent.id],
            ["color", "partner_latitude"],
            child_field="child_ids",
        )
        self.assertEqual(
            by_parent[grandparent.id]["color"],
            by_child[grandparent.id]["color"],
        )
        self.assertAlmostEqual(
            by_parent[grandparent.id]["partner_latitude"],
            by_child[grandparent.id]["partner_latitude"],
            places=3,
        )
        self.assertAlmostEqual(
            by_child[grandparent.id]["partner_latitude"], 60.875, places=3
        )

    def test_aggregate_rejects_an_unknown_field(self):
        """Reject a total asked for on a field that does not exist.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_aggregate(
                [], ["no_such_field_at_all"], parent_field="parent_id"
            )
        self.assertIn("no_such_field_at_all", str(error.exception))
        self.assertIn("does not exist", str(error.exception))

    def test_aggregate_rejects_a_non_numeric_field(self):
        """Reject a total asked for on a field that is not numeric.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_aggregate(
                [], ["name"], parent_field="parent_id"
            )
        self.assertIn("is not a numeric field", str(error.exception))

    def test_aggregate_rejects_a_field_that_is_not_stored(self):
        """Reject a total asked for on a field that is not stored.

        A total is built from a query, so a computed column that lives
        nowhere in the database cannot be summed at all.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_aggregate(
                [], ["active_lang_count"], parent_field="parent_id"
            )
        self.assertIn("is not stored", str(error.exception))

    def test_aggregate_rejects_a_missing_walk_field(self):
        """Reject an aggregation that cannot reach any descendant.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_aggregate([], ["color"])
        self.assertIn("Neither parent_field nor child_field", str(error.exception))

    def test_aggregate_rejects_cyclic_data(self):
        """Reject a subtree walk that never reaches a leaf record.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value) combined with the raw SQL needed to produce the
        cycle: ``res.partner._check_parent_id`` makes a cycle unwritable
        through the ORM, and YAML has no way to bypass a constraint
        (L-02).
        """
        root = self.env["res.partner"].create({"name": "SSIWHV Agg Cycle Root"})
        child = self.env["res.partner"].create(
            {"name": "SSIWHV Agg Cycle Child", "parent_id": root.id}
        )
        self.env["res.partner"].flush()
        self.env.cr.execute(
            "UPDATE res_partner SET parent_id = %s WHERE id = %s",
            (child.id, root.id),
        )
        self.env["res.partner"].invalidate_cache()
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_aggregate(
                [root.id], ["color"], parent_field="parent_id"
            )
        self.assertIn("nested deeper than 64 levels", str(error.exception))

    def test_grand_total_of_one_root_equals_its_subtree_total(self):
        """Assert the grand total of a lone root equals its own total.

        The grand total row and a parent row have to agree with each
        other whenever there is nothing to deduplicate, otherwise the two
        methods would be reporting two different hierarchies.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        grandparent = self._create_partner_amount_chain("SSIWHV Grand One")[0]
        partner_model = self.env["res.partner"]
        totals = partner_model.hierarchy_grand_total(
            [grandparent.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        subtree = partner_model.hierarchy_aggregate(
            [grandparent.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        self.assertEqual(totals["color"], subtree[grandparent.id]["color"])
        self.assertAlmostEqual(
            totals["partner_latitude"],
            subtree[grandparent.id]["partner_latitude"],
            places=3,
        )
        self.assertEqual(totals["color"], 7)
        self.assertAlmostEqual(totals["partner_latitude"], 60.875, places=3)

    def test_grand_total_counts_a_descendant_only_once(self):
        """Assert overlapping subtrees do not inflate the grand total.

        This is the regression lock of the whole method: handing over a
        grandparent, its child and its grandchild at once is exactly what
        a ``child_field``-only view does, since every record matching the
        domain is a root there. Summing the three subtree totals in the
        browser would count the grandchild three times and the child
        twice; the total has to stay the one of the grandparent alone.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        grandparent, parent, child = self._create_partner_amount_chain(
            "SSIWHV Grand Overlap"
        )
        totals = self.env["res.partner"].hierarchy_grand_total(
            [grandparent.id, parent.id, child.id],
            ["color", "partner_latitude"],
            parent_field="parent_id",
        )
        self.assertEqual(totals["color"], 7)
        self.assertAlmostEqual(totals["partner_latitude"], 60.875, places=3)

    def test_grand_total_of_no_node_is_zero_per_field(self):
        """Assert an empty node list still answers every asked field.

        The browser draws a grand total row as soon as a column asks for
        a total, so an empty page has to report ``0`` rather than a dict
        holding nothing at all.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        totals = self.env["res.partner"].hierarchy_grand_total(
            [], ["color", "partner_latitude"], parent_field="parent_id"
        )
        self.assertEqual(set(totals), {"color", "partner_latitude"})
        self.assertEqual(totals["color"], 0)
        self.assertEqual(totals["partner_latitude"], 0)

    def test_grand_total_by_parent_field_and_by_child_field_match(self):
        """Assert both ways of walking the tree report one same total.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method) and trigger P2 (L-04: there is no float
        tolerance in YAML).
        """
        grandparent, parent, child = self._create_partner_amount_chain(
            "SSIWHV Grand Both"
        )
        node_ids = [grandparent.id, parent.id, child.id]
        partner_model = self.env["res.partner"]
        by_parent = partner_model.hierarchy_grand_total(
            node_ids, ["color", "partner_latitude"], parent_field="parent_id"
        )
        by_child = partner_model.hierarchy_grand_total(
            node_ids, ["color", "partner_latitude"], child_field="child_ids"
        )
        self.assertEqual(by_parent["color"], by_child["color"])
        self.assertAlmostEqual(
            by_parent["partner_latitude"],
            by_child["partner_latitude"],
            places=3,
        )
        self.assertAlmostEqual(by_child["partner_latitude"], 60.875, places=3)

    def test_grand_total_rejects_a_non_numeric_field(self):
        """Reject a grand total asked for on a field that is not numeric.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_grand_total(
                [], ["name"], parent_field="parent_id"
            )
        self.assertIn("is not a numeric field", str(error.exception))

    def test_grand_total_rejects_a_field_that_is_not_stored(self):
        """Reject a grand total asked for on a field that is not stored.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_grand_total(
                [], ["active_lang_count"], parent_field="parent_id"
            )
        self.assertIn("is not stored", str(error.exception))

    def test_grand_total_rejects_a_missing_walk_field(self):
        """Reject a grand total that cannot reach any descendant.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields, so
        the guard cannot be reached declaratively).
        """
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_grand_total([], ["color"])
        self.assertIn("Neither parent_field nor child_field", str(error.exception))

    def test_grand_total_rejects_cyclic_data(self):
        """Reject a grand total walk that never reaches a leaf record.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value) combined with the raw SQL needed to produce the
        cycle: ``res.partner._check_parent_id`` makes a cycle unwritable
        through the ORM, and YAML has no way to bypass a constraint
        (L-02).
        """
        root = self.env["res.partner"].create({"name": "SSIWHV Grand Cycle Root"})
        child = self.env["res.partner"].create(
            {"name": "SSIWHV Grand Cycle Child", "parent_id": root.id}
        )
        self.env["res.partner"].flush()
        self.env.cr.execute(
            "UPDATE res_partner SET parent_id = %s WHERE id = %s",
            (child.id, root.id),
        )
        self.env["res.partner"].invalidate_cache()
        with self.assertRaises(UserError) as error:
            self.env["res.partner"].hierarchy_grand_total(
                [root.id], ["color"], parent_field="parent_id"
            )
        self.assertIn("nested deeper than 64 levels", str(error.exception))

    def test_aggregate_without_currency_keeps_the_old_shape(self):
        """Assert the default answer is the plain number it always was.

        This is the regression lock of the contract documented in
        ``README.rst``: a caller that never heard of ``with_currency``
        has to keep reading ``{node_id: {field_name: <number>}}`` and
        ``{field_name: <number>}``, not a nested dict.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        eur = self.env.ref("base.EUR")
        grandparent = self._create_amount_chain([usd, eur, usd], [100.0, 20.0, 5.0])[0]
        node_model = self.env[CURRENCY_MODEL]
        totals = node_model.hierarchy_aggregate(
            [grandparent.id], ["x_amount"], parent_field="x_parent_id"
        )
        self.assertNotIsInstance(totals[grandparent.id]["x_amount"], dict)
        self.assertAlmostEqual(totals[grandparent.id]["x_amount"], 125.0, places=2)

        grand_totals = node_model.hierarchy_grand_total(
            [grandparent.id], ["x_amount"], parent_field="x_parent_id"
        )
        self.assertNotIsInstance(grand_totals["x_amount"], dict)
        self.assertAlmostEqual(grand_totals["x_amount"], 125.0, places=2)

    def test_aggregate_with_currency_reports_one_currency(self):
        """Assert a subtree of one single currency reports exactly one id.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        grandparent = self._create_amount_chain([usd, usd, usd], [100.0, 20.0, 5.0])[0]
        totals = self.env[CURRENCY_MODEL].hierarchy_aggregate(
            [grandparent.id],
            ["x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        entry = totals[grandparent.id]["x_amount"]
        self.assertEqual(entry["currency_ids"], [usd.id])
        self.assertAlmostEqual(entry["total"], 125.0, places=2)

    def test_aggregate_with_currency_reports_mixed_currencies(self):
        """Assert a subtree of two currencies reports both of their ids.

        The total itself stays the raw arithmetic sum: nothing is
        converted here, the browser is only told not to show it.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        eur = self.env.ref("base.EUR")
        chain = self._create_amount_chain([usd, eur, usd], [100.0, 20.0, 5.0])
        grandparent = chain[0]
        child = chain[2]
        totals = self.env[CURRENCY_MODEL].hierarchy_aggregate(
            [grandparent.id, child.id],
            ["x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        mixed = totals[grandparent.id]["x_amount"]
        self.assertEqual(set(mixed["currency_ids"]), {usd.id, eur.id})
        self.assertAlmostEqual(mixed["total"], 125.0, places=2)
        # The leaf underneath the mixed parent stays perfectly readable.
        leaf = totals[child.id]["x_amount"]
        self.assertEqual(leaf["currency_ids"], [usd.id])
        self.assertAlmostEqual(leaf["total"], 5.0, places=2)

    def test_aggregate_with_currency_ignores_a_zero_amount(self):
        """Assert a zero in another currency does not silence a column.

        A row worth nothing says nothing about the currency of the
        total, so it must not turn a sound column into a refused one.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        eur = self.env.ref("base.EUR")
        grandparent = self._create_amount_chain([usd, eur, usd], [100.0, 0.0, 5.0])[0]
        totals = self.env[CURRENCY_MODEL].hierarchy_aggregate(
            [grandparent.id],
            ["x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        entry = totals[grandparent.id]["x_amount"]
        self.assertEqual(entry["currency_ids"], [usd.id])
        self.assertAlmostEqual(entry["total"], 105.0, places=2)

    def test_aggregate_with_currency_reports_none_for_a_plain_field(self):
        """Assert a field that is not monetary reports an empty list.

        The browser sends every aggregated column in one single call, so
        a plain integer column has to answer without raising anything.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        eur = self.env.ref("base.EUR")
        grandparent = self._create_amount_chain([usd, eur, usd], [100.0, 20.0, 5.0])[0]
        totals = self.env[CURRENCY_MODEL].hierarchy_aggregate(
            [grandparent.id],
            ["x_color", "x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        self.assertEqual(totals[grandparent.id]["x_color"]["currency_ids"], [])
        self.assertEqual(totals[grandparent.id]["x_color"]["total"], 7)

    def test_grand_total_with_currency_deduplicates_currencies(self):
        """Assert the grand total reports the union of the currencies.

        Handing over a grandparent, its child and its grandchild at once
        is what a ``child_field``-only view does; the currencies of the
        overlapping subtrees have to come back deduplicated, exactly
        like the amount itself.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        eur = self.env.ref("base.EUR")
        grandparent, parent, child = self._create_amount_chain(
            [usd, eur, usd], [100.0, 20.0, 5.0]
        )
        totals = self.env[CURRENCY_MODEL].hierarchy_grand_total(
            [grandparent.id, parent.id, child.id],
            ["x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        entry = totals["x_amount"]
        self.assertEqual(len(entry["currency_ids"]), 2)
        self.assertEqual(set(entry["currency_ids"]), {usd.id, eur.id})
        self.assertAlmostEqual(entry["total"], 125.0, places=2)

    def test_grand_total_with_currency_reports_one_currency(self):
        """Assert a grand total of one single currency reports one id.

        Pure Python — trigger P1 (L-01: the ``call`` action discards the
        return value of a method, and L-02 only lets an assert reach a
        field of a record, never a returned dict) and trigger P2 (L-04:
        there is no float tolerance in YAML).
        """
        self._create_currency_model()
        usd = self.env.ref("base.USD")
        grandparent = self._create_amount_chain([usd, usd, usd], [100.0, 20.0, 5.0])[0]
        totals = self.env[CURRENCY_MODEL].hierarchy_grand_total(
            [grandparent.id],
            ["x_amount"],
            parent_field="x_parent_id",
            with_currency=True,
        )
        self.assertEqual(totals["x_amount"]["currency_ids"], [usd.id])
        self.assertAlmostEqual(totals["x_amount"]["total"], 125.0, places=2)

    def test_aggregate_rejects_an_unreachable_currency_field(self):
        """Reject a monetary field whose currency field does not exist.

        Silently dropping it would hand the browser a column it believes
        to be single-currency while nothing was ever read to prove it.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields) and
        trigger P6 (L-15: the field has to be patched, since a monetary
        field pointing nowhere cannot even be set up by the registry).
        """
        self._create_currency_model()
        node_model = self.env[CURRENCY_MODEL]
        field = node_model._fields["x_amount"]
        with mock.patch.object(field, "currency_field", "x_no_such_currency"):
            with self.assertRaises(UserError) as error:
                node_model.hierarchy_aggregate(
                    [],
                    ["x_amount"],
                    parent_field="x_parent_id",
                    with_currency=True,
                )
        self.assertIn("x_no_such_currency", str(error.exception))
        self.assertIn("does not exist", str(error.exception))

    def test_grand_total_rejects_an_unreachable_currency_field(self):
        """Reject the same unreachable currency field on the grand total.

        Pure Python — trigger P1 (L-01: the method is called for its
        return value, and L-02 keeps YAML asserts on record fields) and
        trigger P6 (L-15: the field has to be patched, since a monetary
        field pointing nowhere cannot even be set up by the registry).
        """
        self._create_currency_model()
        node_model = self.env[CURRENCY_MODEL]
        field = node_model._fields["x_amount"]
        with mock.patch.object(field, "currency_field", "x_no_such_currency"):
            with self.assertRaises(UserError) as error:
                node_model.hierarchy_grand_total(
                    [],
                    ["x_amount"],
                    parent_field="x_parent_id",
                    with_currency=True,
                )
        self.assertIn("x_no_such_currency", str(error.exception))
        self.assertIn("does not exist", str(error.exception))
