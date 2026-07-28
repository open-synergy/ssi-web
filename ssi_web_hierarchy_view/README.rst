.. image:: https://img.shields.io/badge/licence-AGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/AGPL-3.0-standalone.html
   :alt: License: AGPL-3

==================
Web Hierarchy View
==================

Adds a generic ``hierarchy`` view type: a collapsible column tree that loads
its children lazily and opens the form view when a row is clicked.

Odoo 8 had a dedicated tree view (``web/static/src/js/view_tree.js``) that
drew exactly this: an expandable parent/child tree, with the child relation
named by the view's ``field_parent``. That view was removed in Odoo 9, and in
Odoo 14 the name ``tree`` is already taken by the list view. This module
brings the capability back under a new name, so that hierarchical models in
an SSI installation (partner categories, product categories, an
organizational structure, ...) can be browsed as a tree instead of only as a
flat list or through a ``child_of`` filter.

This iteration is **read only**: dragging a row to reparent it, inline edit
and ``groupBy`` are out of scope. Searching within the hierarchy,
``decoration-*``, a sticky header beyond the column headers, keyboard
navigation and numeric column aggregation (``sum=``) are not implemented
either.

Usage
=====

Declare a view whose root tag is ``hierarchy`` and add ``hierarchy`` to the
``view_mode`` of the action::

    <field name="view_mode">tree,form,hierarchy</field>

Note that the view type is ``hierarchy``, not ``tree``: ``tree`` is already
the list view in Odoo 14.

Determining the hierarchy
-------------------------

+------------------+----------+------------------------------------------------------+
| Attribute        | Required | Meaning                                              |
+==================+==========+======================================================+
| ``child_field``  | one of   | ``one2many``/``many2many`` to the same model, the    |
|                  |          | source of a node's children                          |
+------------------+----------+------------------------------------------------------+
| ``parent_field`` | one of   | ``many2one`` to the same model, determines the roots |
|                  |          | and, together with an id, a node's children          |
+------------------+----------+------------------------------------------------------+

At least one of the two is required; both may be set together. Writing
neither is rejected when the view is saved, as is a ``parent_field`` that is
not a ``many2one`` to the same model, or a ``child_field`` that is not a
``one2many``/``many2many`` to the same model.

* With ``parent_field`` set, the roots are the records whose
  ``parent_field`` is empty (``[(parent_field, "=", False)]`` is added to the
  domain).
* With only ``child_field`` set, every record matching the view's domain is a
  root — the same behaviour the old Odoo 8 tree view had.

Expanding a node reads its children differently depending on which attribute
drives it: with ``child_field``, the ids it already carries are read
directly, with no search at all; with only ``parent_field``, a
``search_read`` is issued with ``[(parent_field, "=", <node id>)]``. Whether
a node has children at all is known from the length of ``child_field``
without any extra query; in ``parent_field``-only mode it is computed with
one ``read_group`` per level across every id of that level, not one query per
node.

Columns
-------

The first ``<field>`` child of the ``hierarchy`` tag is the hierarchy column:
it carries the indentation and the expand/collapse toggle. Every other
``<field>`` is a plain column. Without any ``<field>`` at all, the hierarchy
column falls back to ``display_name``.

Other attributes
----------------

+--------------------+----------+----------+------------------------------------------------+
| Attribute          | Required | Default  | Meaning                                        |
+====================+==========+==========+================================================+
| ``default_expand`` | no       | ``0``    | Depth automatically opened when the view loads |
+--------------------+----------+----------+------------------------------------------------+
| ``limit``          | no       | ``1000`` | Maximum number of nodes kept in memory         |
+--------------------+----------+----------+------------------------------------------------+

**Expand All** loads and opens every node reachable from the current roots,
one level at a time, until either every node is open or ``limit`` is reached;
hitting the limit shows a warning notification rather than an error, and
whatever was already expanded stays expanded. **Collapse All** closes every
open node without discarding what was already loaded, so re-expanding
afterwards is instant.

Clicking a row opens the record's form view the same way clicking a row does
in a standard list view. The expansion state lives in the controller, so it
survives navigating to the form view and back through the breadcrumb.

Only the root level is paginated (80 per page, using the same pager as a
list view); the children of an expanded node are never paginated.

Example
-------

::

    <record id="res_partner_view_hierarchy" model="ir.ui.view">
        <field name="name">res.partner.hierarchy</field>
        <field name="model">res.partner</field>
        <field name="arch" type="xml">
            <hierarchy
                parent_field="parent_id"
                child_field="child_ids"
                default_expand="1"
            >
                <field name="name" />
                <field name="email" />
            </hierarchy>
        </field>
    </record>

Known limitations
=================

* Read only: nodes cannot be dragged to reparent them, and there is no
  inline edit.
* No hierarchical search: matching, highlighting the parent chain of a match,
  and ``groupBy`` are not part of this iteration.
* No ``decoration-*`` and no sticky header beyond the column headers.
* No keyboard navigation.
* No numeric column aggregation (``sum=``).

Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository
    https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list (Must be on developer mode)
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Web Hierarchy View*
6.  Install the module

Bug Tracker
===========

Bugs are tracked on `GitHub Issues
<https://github.com/open-synergy/ssi-web/issues>`_. In case of
trouble, please check there if your issue has already been reported.
If you spotted it first, help us smash it by providing detailed and
welcomed feedback.

Credits
=======

Contributors
------------

* Andhitia Rama <andhitia.r@gmail.com>

Maintainer
----------

.. image:: https://simetri-sinergi.id/logo.png
   :alt: PT. Simetri Sinergi Indonesia
   :target: https://simetri-sinergi.id

This module is maintained by the PT. Simetri Sinergi Indonesia.
