====================
Widget CSV Table
====================

.. |badge1| image:: https://img.shields.io/badge/licence-LGPL--3-blue.png
    :target: http://www.gnu.org/licenses/lgpl-3.0-standalone.html
    :alt: License: LGPL-3

|badge1|

This module provides a ``csv_table`` widget for Text fields that stores data
as CSV but renders it as a spreadsheet-like HTML table in readonly mode.

**Table of contents**

.. contents::
   :local:

Usage
=====

In your XML view, use the widget on any Text field that contains CSV data:

.. code-block:: xml

    <field name="raw_data" widget="csv_table" />

The widget will:

* **Readonly mode**: Parse the CSV text and display it as a styled table with
  row numbers, sticky headers, numeric alignment, and row count info.
* **Edit mode**: Show a standard textarea for CSV input/editing.

Bug Tracker
===========

Bugs are tracked on `GitHub Issues <https://github.com/open-synergy/ssi-web/issues>`_.

Credits
=======

Authors
~~~~~~~

* PT. Simetri Sinergi Indonesia

Contributors
~~~~~~~~~~~~

* `PT. Simetri Sinergi Indonesia <https://simetri-sinergi.id>`_

Maintainers
~~~~~~~~~~~

This module is maintained by the PT. Simetri Sinergi Indonesia.
