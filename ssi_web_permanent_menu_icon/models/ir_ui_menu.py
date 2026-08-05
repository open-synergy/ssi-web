# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import fields, models

#: Keys ``write()`` inspects to decide whether a call touches the menu
#: icon. ``web_icon_data`` is included even though core only ever sets
#: it itself (from ``web_icon``), so a direct write of that key is
#: caught too.
ICON_FIELD_NAMES = ("web_icon", "web_icon_data")


class IrUiMenu(models.Model):
    """
    Lets a manually customized menu icon survive module updates.

    Adds ``web_icon_permanent``: once a menu is flagged, module data
    loading (``odoo -u``, which replays every non-``noupdate``
    ``<menuitem>`` record) can no longer overwrite its ``web_icon`` /
    ``web_icon_data``. Menus never flagged keep following their owning
    module's XML definition exactly as core does today.
    """

    _name = "ir.ui.menu"
    _inherit = ["ir.ui.menu"]

    web_icon_permanent = fields.Boolean(
        string="Permanent Web Icon",
        default=False,
        help="When enabled, this menu's web icon (and its computed "
        "icon data) is no longer overwritten when the owning module "
        "is updated (`odoo -u`). Untick to let module updates set the "
        "icon again.",
    )

    def write(self, vals):
        """Protect a user-customized icon from module update loading.

        Extends core ``write()`` (which recomputes ``web_icon_data``
        whenever ``web_icon`` is present in ``vals``) with a guard for
        menus flagged ``web_icon_permanent``:

        - No icon key (``web_icon``/``web_icon_data``) in ``vals`` →
          behaves exactly like core, regardless of context. Writing
          ``web_icon_permanent`` alone never arms the flag.
        - An icon key is present **and** the call runs under
          ``install_mode`` (set by core's module data loader,
          ``odoo/models.py::_load_records``) → records already flagged
          ``web_icon_permanent`` keep their current icon (the icon
          keys are dropped from their ``vals`` before writing any
          remaining fields such as ``name``); the rest of ``self``
          is written unchanged, icon included.
        - An icon key is present **and** the call is a regular,
          non-install-mode write (e.g. the user editing the Menu
          Items form) → the flag is set to ``True`` automatically, so
          the next module update will no longer touch this icon.

        :param vals: field values to write; not mutated in place
        :return: ``True`` when records were split by the
            ``install_mode`` guard above, otherwise the return value
            of core ``write()``
        """
        vals = dict(vals)
        icon_keys = [key for key in ICON_FIELD_NAMES if key in vals]
        if not icon_keys:
            return super().write(vals)

        if self.env.context.get("install_mode"):
            locked = self.filtered("web_icon_permanent")
            unlocked = self - locked
            locked_vals = {
                key: value for key, value in vals.items() if key not in icon_keys
            }
            if locked_vals:
                super(IrUiMenu, locked).write(locked_vals)
            super(IrUiMenu, unlocked).write(vals)
            return True

        vals["web_icon_permanent"] = True
        return super().write(vals)
