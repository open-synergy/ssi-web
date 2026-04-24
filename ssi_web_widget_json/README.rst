.. image:: https://img.shields.io/badge/licence-LGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/lgpl-3.0-standalone.html
   :alt: License: LGPL-3

==================
Widget JSON Viewer
==================

A field widget (``json_viewer``) that renders a ``Text`` field containing JSON
as an interactive, collapsible tree in read-only mode and as a validated textarea
in edit mode.

Usage
=====

Apply the widget to any text field in a form or tree view::

    <field name="json_field" widget="json_viewer"/>

Features
--------

* **Read-only mode** — syntax-highlighted, expandable/collapsible tree view.
* **Edit mode** — monospace textarea with real-time valid/invalid JSON feedback.
* **Tab support** — pressing Tab in the editor inserts 4 spaces.
* **Graceful fallback** — displays raw text if the stored value is not valid JSON.
* **Odoo 14 legacy JS** — does not require OWL.

Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Widget JSON Viewer*
6.  Install the module

Bug Tracker
===========

Bugs are tracked on `GitHub Issues
<https://github.com/open-synergy/ssi-web/issues>`_.
In case of trouble, please check there if your issue has already been reported.
If you spotted it first, help us smashing it by providing a detailed
and welcomed feedback.

Credits
=======

Contributors
------------

* Andhitia Rama <andhitia.r@gmail.com>

Maintainer
----------

.. image:: https://simetri-sinergi.id/logo.png
   :alt: PT. Simetri Sinergi Indonesia
   :target: https://simetri-sinergi.id.com

This module is maintained by the PT. Simetri Sinergi Indonesia.
