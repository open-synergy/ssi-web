.. image:: https://img.shields.io/badge/licence-LGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/lgpl-3.0-standalone.html
   :alt: License: LGPL-3

============================
Widget RJSF JSON Data Schema
============================

A field widget (``rjsf``) that lets users edit a ``Text`` field containing JSON
using `React JSON Schema Form (RJSF) <https://rjsf-team.github.io/react-jsonschema-form/>`_
in edit mode. In read-only mode the stored JSON is displayed as a formatted block.

Usage
=====

Apply the widget to any text field in a form view and supply a JSON Schema via
the ``options`` attribute::

    <field
        name="json_data"
        widget="rjsf"
        options='{"schema": {"type": "object",
                             "properties": {"name": {"type": "string"},
                                            "age":  {"type": "integer"}}}}'
    />

Available options
-----------------

+------------------+----------+---------+-------------------------------------------------------+
| Option           | Type     | Default | Description                                           |
+==================+==========+=========+=======================================================+
| ``schema``       | object   | —       | **Required.** JSON Schema describing the form.        |
+------------------+----------+---------+-------------------------------------------------------+
| ``uiSchema``     | object   | ``{}``  | RJSF uiSchema for UI customization.                   |
+------------------+----------+---------+-------------------------------------------------------+
| ``liveValidate`` | boolean  | false   | Validate against schema on every change.              |
+------------------+----------+---------+-------------------------------------------------------+
| ``omitExtraData``| boolean  | false   | Strip keys not described in the schema on save.       |
+------------------+----------+---------+-------------------------------------------------------+

Features
--------

* **Edit mode** — full RJSF form rendered from the supplied JSON Schema.
* **Read-only mode** — stored JSON displayed as a pretty-printed code block.
* **Live validation** — optional real-time schema validation via ajv8.
* **No OWL** — built on Odoo 14 legacy JS (``web.AbstractField``).
* **Self-contained** — bundles React 17, ``@rjsf/core`` 5, and
  ``@rjsf/validator-ajv8`` 5; no CDN dependency.

Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list (Must be on developer mode)
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Widget RJSF JSON Data Schema*
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
