.. image:: https://img.shields.io/badge/license-AGPL--3-blue.png
   :target: https://www.gnu.org/licenses/agpl
   :alt: License: AGPL-3

==============================
Widget WhatsApp Message Button
==============================

This module adds a new field widget named ``whatsapp_message`` for Odoo 14.

When applied to a ``Char`` field containing a phone number, the widget renders
a single clickable WhatsApp icon button in **view (readonly) mode**.  In
**edit mode** the field behaves as a standard text input so the number can
still be edited.

Clicking the button opens a new browser tab pointing to
``https://wa.me/<phone_number>``, allowing the user to start a WhatsApp
conversation directly from Odoo.

Usage
=====

Add ``widget="whatsapp_message"`` to any ``<field>`` tag that stores a phone
number::

    <field name="mobile" widget="whatsapp_message"/>
    <field name="phone"  widget="whatsapp_message"/>

The phone number stored in the field should be in international format
(e.g. ``+628123456789`` or ``628123456789``).  Non-numeric characters such as
spaces, dashes, parentheses and the leading ``+`` are stripped automatically
before building the WhatsApp URL.

Bug Tracker
===========

Bugs are tracked on `GitHub Issues <https://github.com/open-synergy/ssi-web/issues>`_.

Credits
=======

Authors
~~~~~~~

* PT. Simetri Sinergi Indonesia
* OpenSynergy Indonesia
