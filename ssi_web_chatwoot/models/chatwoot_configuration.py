# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

import hashlib
import hmac

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class ChatwootConfiguration(models.Model):
    """
    Represents the connection settings used to embed the Chatwoot
    Website Widget SDK into the Odoo backend systray. Only one
    configuration may be active per company; the active configuration
    is resolved at runtime by the systray widget through
    ``get_widget_settings`` to obtain the base URL, website token, and
    the current user's identity payload needed to boot the SDK.
    """

    _name = "chatwoot_configuration"
    _inherit = ["mixin.master_data"]
    _description = "Chatwoot Configuration"

    base_url = fields.Char(
        string="Base URL",
        required=True,
        help="Base URL of the Chatwoot instance serving the widget SDK, "
        "e.g. https://chat.simetri-sinergi.id",
    )
    website_token = fields.Char(
        string="Website Token",
        required=True,
        help="Website token of the Chatwoot inbox the widget connects to.",
    )
    hmac_token = fields.Char(
        string="HMAC Token",
        groups="base.group_system",
        help="Chatwoot identity validation HMAC key. Used only on the "
        "server side to derive a per-user identifier hash; never sent "
        "to the browser. Restricted to Settings administrators.",
    )
    identity_validation_ok = fields.Boolean(
        string="Enable Identity Validation",
        default=False,
        help="When enabled, an identifier_hash derived from the HMAC "
        "token is sent to Chatwoot so the contact is recognized as an "
        "authenticated Odoo user instead of an anonymous visitor.",
    )
    widget_locale = fields.Char(
        string="Widget Locale",
        default="en",
        help="Locale code passed to the Chatwoot widget SDK, e.g. en, id.",
    )
    widget_position = fields.Selection(
        string="Widget Position",
        selection=[("left", "Left"), ("right", "Right")],
        default="right",
        help="Screen side where the Chatwoot widget panel is anchored.",
    )
    widget_type = fields.Selection(
        string="Widget Type",
        selection=[
            ("standard", "Standard"),
            ("expanded_bubble", "Expanded Bubble"),
        ],
        default="standard",
        help="Display type passed to the Chatwoot widget SDK.",
    )
    launcher_title = fields.Char(
        string="Launcher Title",
        default="Chat with Support",
        help="Title shown by the Chatwoot widget launcher.",
    )
    company_id = fields.Many2one(
        string="Company",
        comodel_name="res.company",
        default=lambda self: self.env.company,
        help="Company this configuration applies to. Only one active "
        "configuration is allowed per company.",
    )
    group_ids = fields.Many2many(
        string="Allowed Groups",
        comodel_name="res.groups",
        help="Groups whose members may see the support chat systray "
        "button. Leave empty to allow every internal user.",
    )

    @api.constrains("active", "company_id")
    def _check_single_active_configuration(self):
        for configuration in self.sudo():
            if not configuration._check_single_active_configuration_condition():
                error_message = """
Context: Activate Chatwoot configuration
Database ID: %s
Problem: Another active Chatwoot configuration already exists for the
same company
Solution: Deactivate the other configuration before activating this one
""" % (
                    configuration.id,
                )
                raise ValidationError(_(error_message))

    def _check_single_active_configuration_condition(self):
        self.ensure_one()
        if not self.active:
            return True
        other = self.sudo().search(
            [
                ("id", "!=", self.id),
                ("active", "=", True),
                ("company_id", "=", self.company_id.id),
            ],
            limit=1,
        )
        return not other

    @api.model
    def get_widget_settings(self):
        """Return the Chatwoot widget bootstrap payload for the caller.

        Resolves the active configuration for the current user's company,
        checks ``group_ids`` membership, and returns a dict consumed by
        the systray JS to boot the Chatwoot SDK. ``hmac_token`` itself is
        never included in the response; only its derived identifier hash
        is, and only when identity validation is enabled.
        """
        user = self.env.user
        configuration = self.sudo().search(
            [
                ("active", "=", True),
                ("company_id", "=", user.company_id.id),
            ],
            limit=1,
        )
        if not configuration or not configuration._check_widget_visible_for_user(user):
            return {"enabled": False}

        identifier_hash = False
        if configuration.identity_validation_ok and configuration.hmac_token:
            identifier_hash = hmac.new(
                configuration.hmac_token.encode(),
                user.login.encode(),
                hashlib.sha256,
            ).hexdigest()

        return {
            "enabled": True,
            "base_url": configuration.base_url,
            "website_token": configuration.website_token,
            "locale": configuration.widget_locale,
            "position": configuration.widget_position,
            "type": configuration.widget_type,
            "launcher_title": configuration.launcher_title,
            "user": {
                "identifier": user.login,
                "name": user.name,
                "email": user.email,
                "avatar_url": "/web/image/res.users/%s/avatar_128" % (user.id,),
                "identifier_hash": identifier_hash,
            },
            "custom_attributes": {
                "odoo_database": self.env.cr.dbname,
                "odoo_user_id": user.id,
                "odoo_company": user.company_id.name,
            },
        }

    def _check_widget_visible_for_user(self, user):
        self.ensure_one()
        if not self.group_ids:
            return True
        return bool(self.group_ids & user.groups_id)
