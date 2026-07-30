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
and ``groupBy`` are out of scope. Per column ``decoration-*``
(``<field decoration-…>``) and user resizable or hideable columns are not
implemented either.

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

Numeric column totals
---------------------

A numeric column carries ``sum="<label>"``, spelled exactly like a list
view's own aggregate attribute. Every parent row then shows the total of its
**whole subtree** instead of its own value, and a grand total row is drawn at
the very bottom of the tree::

    <hierarchy parent_field="parent_id">
        <field name="name" />
        <field name="balance" sum="Total Balance" />
    </hierarchy>

* Only ``integer``, ``float`` and ``monetary`` fields may carry ``sum``, and
  only if they are **stored**: the total is computed server side with a
  query, so a non-stored computed column cannot be summed. Anything else is
  **rejected when the view is saved** rather than silently showing nothing.
* The total of a parent row **includes the value of that row itself**, so a
  parent total always equals the sum of the column as it is displayed
  underneath it — which is what the reader of a chart of accounts expects.
* A **leaf** row shows its own value, without the total styling: there is
  nothing summed underneath it.
* A cell showing a total carries the class ``o_hierarchy_aggregate``, so a
  total can be told apart from a plain value and restyled by a database
  without touching this module.
* The **grand total row** totals the union of the subtrees of the roots
  currently on screen, so it follows the active domain and the active page of
  the pager. The label given to ``sum=`` is its tooltip.
* Every record is counted **exactly once** in the grand total, however many
  of its ancestors are on screen. This matters in a ``child_field``-only
  view, where every record matching the domain is a root (see *Determining
  the hierarchy*) and the subtrees of the rows therefore overlap: the grand
  total there is deliberately **not** the sum of the column as it is
  displayed, precisely because the displayed values overlap each other.
* The grand total does **not** change when a node is opened or closed:
  opening a node adds no root, and the total already covers every descendant
  of the roots whether they are visible or not.
* Rounding and formatting follow the field itself: ``digits`` for a float, and
  for a ``monetary`` column the currency named by the ``currency_field`` that
  field declares — the view fetches that currency field next to the column
  for that very reason.

Monetary totals and mixed currencies
------------------------------------

A total of a ``monetary`` column is only ever shown as a number when **every
record it is made of uses one and the same currency**. That set of currencies
is reported by the **server**, which knows every descendant, rather than read
off whichever row the browser happens to have loaded:

* One currency — the amount is shown, formatted with that very currency, on a
  parent row and on the grand total row alike.
* Several currencies — **no amount is shown at all**. The cell shows an em
  dash (``—``) and says why in its ``title`` tooltip. Adding up amounts of
  different currencies is wrong arithmetic, and labelling the result with one
  of them is wrong twice over, so the cell refuses rather than mislead.
* Such a cell carries the class ``o_hierarchy_aggregate_mixed`` next to
  ``o_hierarchy_aggregate``, so a database can restyle exactly those cells
  without touching this module.
* **Only a record whose value is neither zero nor empty contributes its
  currency.** A row worth ``0`` in another currency says nothing about the
  currency of the total, and letting it count would silence a column that is
  in fact perfectly sound.
* A total made of nothing but zeros reports no currency at all; it is then
  formatted with the currency of the row itself, and with that of the first
  root on screen for the grand total row.

The totals are computed by ``hierarchy_aggregate(node_ids, field_names,
parent_field=None, child_field=None, with_currency=False)``, a method this
module adds to every model. It returns ``{node_id: {field_name: total}}``
with one entry per given id, and is called **once per level** — for every id
of that level at once, never once per node. Descendants are walked through
``parent_field`` when it is set and through ``child_field`` otherwise;
``child_of`` is deliberately not used, since it would require the walked
field to be the model's ``_parent_name``. Access rights are honoured — there
is no ``sudo()``: a descendant the user may not read is left out of the
total, consistently with the rows that user sees. A tree nested deeper than
64 levels is treated as cyclic data and raises, rather than looping forever.

The grand total row is computed by ``hierarchy_grand_total(node_ids,
field_names, parent_field=None, child_field=None, with_currency=False)``, a
second method this module adds to every model. It merges the subtrees of
``node_ids`` into one single set of ids before summing, and returns
``{field_name: total}`` with one entry per given name — ``0`` for every name
when ``node_ids`` is empty. That merge is what makes a record count exactly
once even when several of its ancestors are on screen; it validates its
fields, walks the tree and honours access rights exactly like
``hierarchy_aggregate``, so a grand total over one single root equals the
total that method reports for that root. It is called only when the set of
roots changes — first load, new domain, new page of the pager, entering or
leaving search mode — never when a node is opened.

Both methods take the same optional ``with_currency`` keyword argument:

* ``with_currency=False``, the default, returns exactly the shapes above —
  ``{node_id: {field_name: total}}`` and ``{field_name: total}`` — so any
  existing caller keeps working untouched.
* ``with_currency=True`` turns every field entry into
  ``{"total": total, "currency_ids": [id, ...]}``. ``currency_ids`` holds the
  currencies of the records that actually contributed a non-zero value, and
  is an **empty list** on a column that is not ``monetary``, so the browser
  may send every aggregated column in one single call without sorting them
  out first. A ``monetary`` field whose ``currency_field`` does not exist on
  the model is **rejected** rather than silently ignored.

The browser only asks for ``with_currency=True`` when at least one aggregated
column is ``monetary``; on any other tree the calls and their answers are
exactly what they were.

Row decorations
---------------

A row is coloured by the ``decoration-*`` attributes of the ``hierarchy``
tag, the same way a list view colours its own rows. The value of such an
attribute is a Python expression evaluated in the browser against the values
of the row::

    <hierarchy parent_field="parent_id" decoration-danger="not active">
        <field name="name" />
    </hierarchy>

Seven suffixes are supported, exactly the ones ``ssi_web_gantt`` supports:
``danger``, ``warning``, ``info``, ``success``, ``primary``, ``secondary``
and ``muted``. Anything else — ``decoration-mantap``, a misspelt
``decoration-sucess`` — is **rejected when the view is saved** rather than
ignored silently, and so is an expression that is not valid Python.

* A row a decoration lights up on carries the class
  ``o_hierarchy_row_<suffix>``, so a database may restyle a decoration
  without touching this module.
* Several decorations may light up on the same row. They are applied in the
  order of the list above, so the last one that lights up is the colour
  actually seen.
* A field read by an expression is fetched even when it is no column of the
  tree: the view registers it server side, which is also what makes an
  expression naming a field that does not exist fail at save time instead of
  in the browser.
* The expression is evaluated against the row's own values plus ``uid``,
  ``today`` and ``now``.

Sticky header and keyboard navigation
-------------------------------------

The column headers stay visible while a long tree is scrolled. This is
plain CSS (``position: sticky`` on the header cells), so there is no scroll
listener and no position arithmetic anywhere.

The tree is fully reachable from the keyboard. The focus is on rows, never on
cells, and only one row at a time is reachable with ``Tab`` (a roving
``tabindex``), so ``Tab`` steps over the tree instead of walking through
every single row.

``ArrowDown`` / ``ArrowUp``
  Move to the next/previous visible row.

``ArrowRight``
  Open a closed node; move to its first child when it is already open.

``ArrowLeft``
  Close an open node; move to its parent when it is already closed.

``Enter``
  Open the form view of the focused row.

``Home`` / ``End``
  Move to the first/last visible row.

Moving the focus never changes the page of the pager, and the expansion
state is only ever changed by ``ArrowLeft``/``ArrowRight``. The tree exposes
``role="tree"``, every row ``role="treeitem"`` with ``aria-level``,
``aria-setsize``/``aria-posinset`` and, on a node that has children,
``aria-expanded``.

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

Searching the hierarchy
-----------------------

Filtering from the search view does **not** filter the root level only: a
record matching the filter is shown wherever it sits in the tree, together
with its whole parent chain, and that chain comes already expanded. So a
match five levels deep is reachable in one filter instead of five manual
expansions.

* A row that matched the filter carries the class ``o_hierarchy_match`` and
  is highlighted.
* A row present only because it is an ancestor of a match carries the class
  ``o_hierarchy_context`` and is **not** highlighted, so it reads as
  context rather than as a result.
* ``default_expand`` has no say while a filter is active: what is expanded
  is exactly the chains leading to the matches. Clearing the filter goes
  back to the full tree, ``default_expand`` included.
* ``limit`` caps the number of **matches** here, not the number of nodes
  kept in memory. When it cuts the result short, the same warning
  notification as **Expand All** is shown. The pager is hidden while a
  filter is active: the result is a tree of matches, not a page of roots.

The matches and their ancestors are resolved by a single call to
``hierarchy_search_ancestors(domain, parent_field, limit=None)``, a method
this module adds to every model. It returns ``matches`` (ids matching the
domain, in the model's ``_order``), ``ancestors`` (ids of their ancestors
that do not match the domain themselves) and ``truncated``. Access rights
are honoured — there is no ``sudo()``: an ancestor the user may not read is
dropped silently, and its child then shows up at the top level of the tree.
A parent chain longer than 64 levels is treated as cyclic data and raises,
rather than looping forever.

.. important::

   Hierarchical search needs ``parent_field``. A view declaring only
   ``child_field`` cannot walk a chain upwards — a record does not know its
   parent there — so filtering such a view falls back to **flat
   filtering**: the matching records are listed as roots, without their
   parent chain, and can still be expanded downwards. Add ``parent_field``
   next to ``child_field`` to get hierarchical search.

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
                decoration-muted="not active"
                decoration-info="is_company"
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
* Hierarchical search needs ``parent_field``; a ``child_field``-only view
  falls back to flat filtering (see *Searching the hierarchy*).
* No ``groupBy``: grouping records would collide with the hierarchy itself.
* No client-side search inside the already loaded tree: filtering always
  goes back to the server.
* ``decoration-*`` is per row only: ``<field decoration-…>``, which colours
  a single cell in a list view, is not supported.
* No user resizable or hideable columns, and no preference remembering
  either.
* Column aggregation is a **sum** only: ``avg=``, ``min=``, ``max=`` and a
  count of the descendants are not supported, and neither is exporting the
  totals to XLSX/CSV.
* A mixed currency total is refused, not resolved: amounts are never
  converted to the company currency, and one cell never shows one subtotal
  per currency (see *Monetary totals and mixed currencies*).

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
