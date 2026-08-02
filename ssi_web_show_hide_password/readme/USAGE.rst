There is nothing to configure. Once the module is installed, every
password input carries the icon.

* **Login page** — open ``/web/login``. A small eye sits at the right edge
  of the *Password* field; click it to read what you typed.
* **Change Password** — open *My Profile* → *Account Security* → *Change
  Password*. Each of the three fields (Old / New / Confirm) gets its own
  icon, and they toggle independently.
* **Form views and wizards** — any field whose widget renders an
  ``<input type="password">`` is decorated as soon as the view is drawn,
  including views opened later in the session.

The icon is a Font Awesome glyph: ``fa-eye`` while the value is hidden,
``fa-eye-slash`` while it is revealed.
