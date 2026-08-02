Adds a show/hide (eye) icon next to every password field of the system,
without any per-field or per-view configuration.

The icon appears on:

* the public login page (``/web/login``),
* the standard **Change Password** dialog (My Profile → Account Security),
* any backend field rendered as an ``<input type="password">`` — API keys,
  credentials, wizard fields, whatever the model.

Clicking the icon turns the value into plain text and back again.

Implementation note
~~~~~~~~~~~~~~~~~~~

The module does **not** override, include or patch a single core Odoo
widget. A generic script installs one ``MutationObserver`` on the document
and decorates every ``input[type="password"]`` that appears in the DOM,
whenever it appears.

That choice is deliberate. Modules that implement the same feature by
overriding ``web.ChangePassword`` or ``web.basic_fields.InputField`` break
the ``.include()`` chain of every other module extending the same widget —
``auth_password_policy`` among them — and end up throwing ``TypeError`` in
the browser. Staying at DOM level makes this whole class of bug
unreachable.

For the same reason, toggling the visibility only rewrites the ``type``
attribute: no ``input`` or ``change`` event is dispatched on the field, so
listeners such as the password strength meter are never disturbed.
