.. image:: https://img.shields.io/badge/licence-LGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/lgpl-3.0-standalone.html
   :alt: License: LGPL-3

==============================
Widget X2Many Excel Download
==============================

Adds an **Excel Download** button to every One2many and Many2many list
widget rendered inside a form view.

When clicked the button fetches **all** records linked to the field
(not just the records visible on the current page) and exports them as
an ``.xlsx`` file using the SheetJS (xlsx) library bundled with the
module.

Feature flags
=============

The button is **enabled by default** for every ``one2many`` and
``many2many`` field rendered as a list.  To disable it for a specific
field, set the ``excel_download`` option to ``0`` in the field widget
options::

    <field name="line_ids" options="{'excel_download': 0}" />


Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository
    https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list (Must be on developer mode)
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Widget X2Many Excel Download*
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
