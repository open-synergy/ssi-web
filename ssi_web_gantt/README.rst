.. image:: https://img.shields.io/badge/licence-AGPL--3-blue.svg
   :target: http://www.gnu.org/licenses/AGPL-3.0-standalone.html
   :alt: License: AGPL-3

=========
Web Gantt
=========

Adds a generic ``ssi_gantt`` view type that renders records as bars on a
timeline, and draws the dependencies between them.

Odoo 14 Community ships no Gantt renderer at all, and the alternatives draw a
plain arrow between two records with no notion of what kind of dependency it
is. This view draws all four combinations used in project scheduling:

* **FS** — finish to start: the successor may not start before the predecessor
  finishes;
* **SS** — start to start: the successor may not start before the predecessor
  starts;
* **FF** — finish to finish: the successor may not finish before the
  predecessor finishes;
* **SF** — start to finish: the successor may not finish before the predecessor
  starts.

Each dependency carries a **lag** in days or hours, which may be negative, and
an arrow whose constraint the actual schedule breaks is drawn in a *danger*
style with an explanatory tooltip.

The view is a pure view layer: it stores nothing. Where the dependencies live
is described entirely by the attributes of the arch, so the view can be put on
any model whose links are held in a model of its own, or in a simple x2many
field.

This iteration is **read only**. Zooming, switching the time scale, grouping,
tooltips and clicking through to the form view are all supported; dragging,
resizing and drawing a dependency from the interface are not.

Usage
=====

Declare a view whose root tag is ``ssi_gantt`` and add ``ssi_gantt`` to the
``view_mode`` of the action::

    <field name="view_mode">tree,form,ssi_gantt</field>

Note that the view type is ``ssi_gantt``, not ``gantt``: ``gantt`` is already
taken by the Enterprise renderer, and reusing it would make this module try to
render the arch of views it knows nothing about.

Dates
-----

+-------------------------+----------+-----------------+--------------------------------------------------+
| Attribute               | Required | Default         | Meaning                                          |
+=========================+==========+=================+==================================================+
| ``date_start``          | yes      |                 | Date or Datetime field starting the bar          |
+-------------------------+----------+-----------------+--------------------------------------------------+
| ``date_stop``           | one of   |                 | Date or Datetime field ending the bar            |
+-------------------------+----------+-----------------+--------------------------------------------------+
| ``date_delay``          | one of   |                 | Numeric duration; ``finish = start + delay``     |
+-------------------------+----------+-----------------+--------------------------------------------------+
| ``delay_unit``          | no       | ``hours``       | ``hours`` or ``days``, the unit of ``date_delay``|
+-------------------------+----------+-----------------+--------------------------------------------------+
| ``date_stop_inclusive`` | no       | see below       | Whether ``date_stop`` is an inclusive last day   |
+-------------------------+----------+-----------------+--------------------------------------------------+

Either ``date_stop`` or ``date_delay`` must be present; writing neither is
rejected when the view is created. They are evaluated per record, in order: if
``date_stop`` holds a value it wins; otherwise ``date_delay`` is added to the
start; otherwise the record is a **milestone** and is drawn as a diamond.

**The exclusive finish convention.** Internally every record has a ``start``
and a ``finish``, where ``finish`` is the exclusive instant at which the work
stops. A Datetime is already exclusive. A Date field, however, is by Odoo
convention the last **inclusive** day, so it is normalized to
``date_stop + 1 day``. ``date_stop_inclusive`` defaults to true for a Date
field and false for a Datetime field, and setting it explicitly overrides that.

Every bar width, every constraint check and every lag computation uses this
exclusive finish. The consequence is the correct one: a finish-to-start
dependency with a lag of zero whose successor starts *exactly* when the
predecessor ends is satisfied, not violated.

Presentation
------------

+-------------------------+----------+---------------------------------+-----------------------------------------------+
| Attribute               | Required | Default                         | Meaning                                       |
+=========================+==========+=================================+===============================================+
| ``string``              | no       | the view name                   | Title                                         |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``default_group_by``    | no       |                                 | Only the first field is used (see limitations)|
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``progress``            | no       |                                 | Numeric field 0-100, filled inside the bar    |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``color``               | no       |                                 | Integer or Many2one field, ``value % 12``     |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``decoration-*``        | no       |                                 | Python expression per record (see below)      |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``default_scale``       | no       | ``month``                       | One of ``scales``                             |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``scales``              | no       | ``day,week,month,quarter,year`` | Subset, in button order                       |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``default_zoom``        | no       | ``1``                           | Column width multiplier, clamped to 0.5 - 4   |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``event_open_popup``    | no       | ``0``                           | Clicking a bar opens a dialog instead of      |
|                         |          |                                 | switching to the form view                    |
+-------------------------+----------+---------------------------------+-----------------------------------------------+
| ``form_view_id``        | no       | the default form view           | XML id of the form view the dialog shows      |
+-------------------------+----------+---------------------------------+-----------------------------------------------+

``form_view_id`` is only read when ``event_open_popup`` is enabled, and setting
one without the other is refused when the view is saved. It is written as an XML
id, because the database id of a view is not knowable when a module ships it:

.. code-block:: xml

    <ssi_gantt date_start="date_assign" date_stop="date_end"
               event_open_popup="1" form_view_id="project.view_task_form2"/>

The view it names has to exist, be a form view, and be a form view of the model
the Gantt view is on; a view that is none of these is refused when the view is
saved rather than silently opening the wrong form.

The supported decorations are ``decoration-danger``, ``decoration-warning``,
``decoration-info``, ``decoration-success``, ``decoration-primary``,
``decoration-secondary`` and ``decoration-muted``.

**Every field used in a decoration expression must also be declared as a**
``<field name="..."/>`` **child of the** ``ssi_gantt`` **tag.** This is not a
choice of this module: the server enforces it for every view type, exactly as
it does for a tree view, and the view is refused at install time otherwise.

Dependencies, mode A: a link model
----------------------------------

Use this mode when the links live in a model of their own, which is what allows
a type and a lag to be carried. All of these attributes name fields of the
**link** model, not of the model the view is on.

+---------------------------------+----------+-----------+-------------------------------------------------+
| Attribute                       | Required | Default   | Meaning                                         |
+=================================+==========+===========+=================================================+
| ``dependency_model``            | yes      |           | The link model                                  |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_predecessor_field``| yes      |           | Many2one to the **predecessor** record          |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_successor_field``  | yes      |           | Many2one to the **successor** record            |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_type_field``       | no       |           | Type field; empty means every link is FS        |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_lag_field``        | no       |           | Numeric lag, may be negative; empty means 0     |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_lag_unit``         | no       | ``days``  | ``days`` or ``hours``                           |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_domain``           | no       | ``[]``    | Extra domain, ANDed with the endpoint filter    |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_type_map``         | no       |           | Custom type mapping (see below)                 |
+---------------------------------+----------+-----------+-------------------------------------------------+
| ``dependency_type_default``     | no       | ``fs``    | Used when a raw type cannot be normalized       |
+---------------------------------+----------+-----------+-------------------------------------------------+

Dependencies, mode B: an x2many field
-------------------------------------

Use this mode when a record simply points at the records it depends on. Every
link is then a finish-to-start with a lag of zero, and no extra query is made:
the ids already come with the records.

+---------------------------------+----------+-----------------+------------------------------------------+
| Attribute                       | Required | Default         | Meaning                                  |
+=================================+==========+=================+==========================================+
| ``dependency_field``            | yes      |                 | Many2many or One2many onto the same model|
+---------------------------------+----------+-----------------+------------------------------------------+
| ``dependency_field_direction``  | no       | ``predecessor`` | What the field holds (see below)         |
+---------------------------------+----------+-----------------+------------------------------------------+

``dependency_field_direction`` says what the field actually contains:
``predecessor`` means it holds the records that must **come before** this one
(``depends_on_ids``), ``successor`` means it holds the records that **follow**
it (``blocked_task_ids``).

If both modes are configured, mode A wins and mode B is ignored.

Dependency type values
----------------------

The raw value of ``dependency_type_field`` is normalized to one of ``fs``,
``ss``, ``ff`` or ``sf``. A Many2one type field is handled too: both its id and
its label are tried.

These aliases are recognized out of the box, case and punctuation insensitive:

+--------------+---------------------------------------------------------------------------+
| Canonical    | Recognized values                                                         |
+==============+===========================================================================+
| ``fs``       | ``fs``, ``es``, ``finish to start``, ``end to start``, ``0``              |
+--------------+---------------------------------------------------------------------------+
| ``ss``       | ``ss``, ``start to start``, ``1``                                         |
+--------------+---------------------------------------------------------------------------+
| ``ff``       | ``ff``, ``ee``, ``finish to finish``, ``end to end``, ``2``               |
+--------------+---------------------------------------------------------------------------+
| ``sf``       | ``sf``, ``se``, ``start to finish``, ``start to end``, ``3``              |
+--------------+---------------------------------------------------------------------------+

The numeric aliases follow the MS-Project and PMBOK ordering: 0 is FS, 1 is SS,
2 is FF and 3 is SF.

Anything else can be mapped with ``dependency_type_map``, which accepts either
the ``colors``-like syntax, canonical code first::

    dependency_type_map="fs:selesai_mulai|end_start;ss:mulai_mulai;ff:selesai_selesai;sf:mulai_selesai"

or JSON, mapping a raw value to a canonical code::

    dependency_type_map="{&quot;selesai_mulai&quot;: &quot;fs&quot;}"

An empty value falls back to ``dependency_type_default`` silently, since an
empty Selection is legitimate. A value that is neither empty nor recognizable
falls back too, and is reported once in the browser console.

Example, mode A
---------------

::

    <record id="project_task_view_ssi_gantt" model="ir.ui.view">
        <field name="model">project.task</field>
        <field name="type">ssi_gantt</field>
        <field name="arch" type="xml">
            <ssi_gantt
                date_start="planned_date_begin"
                date_stop="date_deadline"
                default_group_by="project_id"
                progress="progress"
                default_scale="week"
                scales="day,week,month,quarter"
                decoration-danger="kanban_state == 'blocked'"
                dependency_model="project_task.dependency"
                dependency_predecessor_field="predecessor_id"
                dependency_successor_field="successor_id"
                dependency_type_field="dependency_type"
                dependency_lag_field="lag_days"
            >
                <field name="kanban_state" />
                <field name="user_id" />
                <templates>
                    <t t-name="gantt-item">
                        <strong><t t-esc="record.display_name" /></strong>
                        <div t-if="record.user_id">
                            <t t-esc="record.user_id[1]" />
                        </div>
                    </t>
                </templates>
            </ssi_gantt>
        </field>
    </record>

``kanban_state`` is declared as a ``<field>`` because ``decoration-danger``
uses it.

The optional ``gantt-item`` QWeb template fills the popover shown when hovering
a bar. Without it, a default popover with the name and the dates is used.

Example, mode B
---------------

::

    <ssi_gantt
        date_start="date_start"
        date_delay="duration"
        delay_unit="days"
        dependency_field="depends_on_ids"
        dependency_field_direction="predecessor"
    >
        <field name="depends_on_ids" />
    </ssi_gantt>

Known limitations
=================

* Read only: bars cannot be dragged or resized, and a dependency cannot be
  drawn from the interface.
* Only one level of grouping is used. A ``default_group_by`` listing several
  fields, or a Group By with several facets, honours the first one only.
* No search panel.
* The chart is laid out left to right and forces ``direction: ltr``, so it does
  not mirror in a right-to-left language.
* Records without a ``date_start`` keep their row, greyed out, but no bar is
  drawn and their dependencies are not shown.
* Neither cycle detection nor critical path computation is done.

Installation
============

To install this module, you need to:

1.  Clone the branch 14.0 of the repository
    https://github.com/open-synergy/ssi-web
2.  Add the path to this repository in your configuration (addons-path)
3.  Update the module list (Must be on developer mode)
4.  Go to menu *Apps -> Apps -> Main Apps*
5.  Search For *Web Gantt*
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
* Michael Viriyananda <viriyananda.michael@gmail.com>

Maintainer
----------

.. image:: https://simetri-sinergi.id/logo.png
   :alt: PT. Simetri Sinergi Indonesia
   :target: https://simetri-sinergi.id

This module is maintained by the PT. Simetri Sinergi Indonesia.
