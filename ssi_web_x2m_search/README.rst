.. image:: https://img.shields.io/badge/licence-AGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/AGPL-3.0-standalone.html
   :alt: License: AGPL-3

=================
Web X2Many Search
=================

Adds the standard Odoo **search bar** inside every One2many and Many2many field
rendered as a list in a form view.

The search bar occupies its own full-width row, above the field's
``Add a line`` button and pager.

Typing in the search bar opens the usual autocompletion dropdown (*Search Name
for: budi*), and validating it creates a search facet, exactly like the search
bar of a regular list view. Several facets can be combined, and each facet can
hold several values. Only the rows matching the facets are displayed, and the
pager of the field reports the number of matching rows.

The search bar is built on the search components of the framework itself
(``SearchBar``, ``ActionModel`` and its control panel model extension). The
fields offered for searching are the columns of the embedded list. The resulting
domain is evaluated **by the server**, so an ``ilike`` on a many2one, a
selection or a date behaves exactly as it does anywhere else in Odoo.

Feature flags
=============

The search bar is **enabled by default** for every ``one2many`` and
``many2many`` field rendered as a list. To disable it for a specific field, set
the ``x2m_search`` option to ``0`` in the field widget options::

    <field name="line_ids" options="{'x2m_search': 0}" />

Fields using a **custom x2many widget** never get a search bar, because such a
widget comes with its own renderer and layout. Only the standard list rendering
is affected, that is a field without a ``widget`` attribute, or a field using
``widget="one2many"`` or ``widget="many2many"``. Fields such as
``section_and_note_one2many``, ``x2many_2d_matrix``, ``many2many_tags`` or
``many2many_checkboxes`` are therefore left untouched, and so are x2many fields
rendered as a kanban.

Known limitations
=================

* Rows that are not saved yet are always visible, even when they do not match
  the facets. Without this, a line added while a filter is active would
  immediately disappear.
* Matching is done by the server, so changes that are not saved yet are not
  taken into account: a row is matched against the values stored in database.
* While a filter is active, all the rows of the field are loaded in the browser.
  For a field holding a very large number of rows, disable the search bar with
  ``options="{'x2m_search': 0}"``.

Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository
    https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list (Must be on developer mode)
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Web X2Many Search*
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
