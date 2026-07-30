# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/AGPL).

from odoo_yaml_test import YamlTransactionCase

from odoo.exceptions import UserError
from odoo.tests import tagged


@tagged("post_install", "-at_install")
class TestSsiWebHierarchyView(YamlTransactionCase):
    """Covers the ``hierarchy`` view type arch validation and the search.

    The arch validation scenarios live in the YAML file; the hierarchical
    search is asserted here because what is under test is the value
    ``hierarchy_search_ancestors`` returns.
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

    def test_ssi_web_hierarchy_view(self):
        """Run the ``hierarchy`` view type arch validation scenarios."""
        self.run_yaml_scenario("test_data_ssi_web_hierarchy_view.yaml")

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
