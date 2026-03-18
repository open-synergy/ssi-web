// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

odoo.define("ssi_web_widget_ace_git.AceGitWidget", function (require) {
    "use strict";

    var core = require("web.core");
    var ajax = require("web.ajax");
    var Dialog = require("web.Dialog");
    var basic_fields = require("web.basic_fields");
    var _t = core._t;

    // In Odoo 14, the ACE widget is "AceEditor" (registered in field registry
    // as 'ace'). It is NOT called "FieldCode".
    var AceEditor = basic_fields.AceEditor;
    if (!AceEditor) {
        return;
    }

    /**
     * Extend AceEditor to add a "Fetch from GitHub" button below the editor
     * in edit mode.
     *
     * DOM structure after rendering:
     *   <div class="oe_form_field o_ace_view_editor o_field_widget">  ← $el
     *       <div class="ace-view-editor"/>     ← ACE editor lives here
     *       <button class="o_ace_git_fetch_btn"/>  ← our button (appended)
     *   </div>
     *
     * Lifecycle notes:
     *  - AceEditor.start() calls _startAce() then _super (Widget/AbstractField)
     *  - AbstractField.start() calls _render() inside .then() after DOM insert
     *  - AceEditor._render() does NOT call _super(), so AbstractField._render()
     *    (which dispatches _renderEdit/_renderReadonly) is never called.
     *  - We therefore override both start() AND _render() to ensure the button
     *    is always present in edit mode.
     *  - The button is appended INSIDE $el so it never needs a parent lookup.
     */
    AceEditor.include({
        // ------------------------------------------------------------------
        // Lifecycle overrides
        // ------------------------------------------------------------------

        /**
         * Called once after $el is inserted into the DOM.
         * Primary entry point for injecting the button.
         *
         * @override
         */
        start: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                self._updateAceGitButton();
            });
        },

        /**
         * AceEditor._render() is called on every value update and on reset().
         * We call _updateAceGitButton() after super to keep the button in sync
         * with the current mode.
         *
         * @override
         */
        _render: function () {
            var result = this._super.apply(this, arguments);
            this._updateAceGitButton();
            return result;
        },

        /**
         * Clean up the button when the widget is destroyed.
         *
         * @override
         */
        destroy: function () {
            this.$(".o_ace_git_fetch_btn").remove();
            this._super.apply(this, arguments);
        },

        // ------------------------------------------------------------------
        // Private helpers
        // ------------------------------------------------------------------

        /**
         * Add the "Fetch dari GitHub" button inside $el (after .ace-view-editor)
         * when mode === 'edit', remove it otherwise.
         * Idempotent — safe to call multiple times.
         */
        _updateAceGitButton: function () {
            var self = this;

            // Always clean up first to prevent duplicates.
            this.$(".o_ace_git_fetch_btn").remove();

            if (this.mode !== "edit") {
                return;
            }

            var $btn = $("<button>", {
                type: "button",
                class: "btn btn-sm btn-secondary o_ace_git_fetch_btn",
                html:
                    '<i class="fa fa-github" aria-hidden="true"></i> ' +
                    _t("Fetch from GitHub"),
                title: _t("Fetch file content from GitHub and insert into the editor"),
            })
                .css({
                    "margin-top": "4px",
                    display: "block",
                })
                .on("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    self._onClickFetchFromGitHub();
                });

            // Append inside $el, after the .ace-view-editor div.
            // This keeps the button within our own DOM and avoids any
            // dependency on the parent container.
            this.$el.append($btn);
        },

        // ------------------------------------------------------------------
        // Actions
        // ------------------------------------------------------------------

        /**
         * Opens the "Fetch from GitHub" dialog.
         */
        _onClickFetchFromGitHub: function () {
            var self = this;

            var $form = $(
                '<div class="o_ace_git_dialog_form">' +
                    '<div class="form-group mb-3">' +
                    '<label class="col-form-label font-weight-bold" for="ace_git_url">' +
                    _t("GitHub File URL") +
                    "</label>" +
                    '<input type="text" id="ace_git_url" name="ace_git_url"' +
                    ' class="form-control"' +
                    ' placeholder="https://github.com/user/repo/blob/main/path/to/file.py"' +
                    ' autocomplete="off" spellcheck="false"/>' +
                    '<small class="form-text text-muted">' +
                    _t(
                        "Supports GitHub web URL (/blob/) or raw URL (raw.githubusercontent.com)."
                    ) +
                    "</small>" +
                    "</div>" +
                    '<div class="form-group mb-1">' +
                    '<label class="col-form-label font-weight-bold" for="ace_git_token">' +
                    _t("GitHub Personal Access Token") +
                    ' <span class="text-muted font-weight-normal">' +
                    _t("(optional for public repos)") +
                    "</span>" +
                    "</label>" +
                    '<input type="password" id="ace_git_token" name="ace_git_token"' +
                    ' class="form-control"' +
                    ' placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' +
                    ' autocomplete="new-password"/>' +
                    '<small class="form-text text-muted">' +
                    _t(
                        "Required for private repositories. Token is not stored on the server."
                    ) +
                    "</small>" +
                    "</div>" +
                    "</div>"
            );

            var dialog = new Dialog(self, {
                title: _t("Fetch File from GitHub"),
                size: "medium",
                $content: $form,
                buttons: [
                    {
                        text: _t("Fetch & Apply"),
                        classes: "btn-primary o_ace_git_submit_btn",
                        click: function () {
                            var url = $form.find("#ace_git_url").val().trim();
                            var token = $form.find("#ace_git_token").val().trim();
                            self._fetchAndInjectContent(url, token, dialog);
                        },
                    },
                    {
                        text: _t("Cancel"),
                        classes: "btn-secondary",
                        close: true,
                    },
                ],
            });

            dialog.open();

            $form.find("#ace_git_url").on("keydown", function (ev) {
                if (ev.which === 13) {
                    ev.preventDefault();
                    dialog.$footer.find(".o_ace_git_submit_btn").trigger("click");
                }
            });
        },

        /**
         * Fetches file content from GitHub via the backend proxy and injects
         * it into the ACE editor.
         *
         * @param {String} github_url
         * @param {String} github_token
         * @param {Dialog} dialog
         */
        _fetchAndInjectContent: function (github_url, github_token, dialog) {
            var self = this;

            if (!github_url) {
                self.do_warn(
                    _t("Warning"),
                    _t("Please enter a GitHub file URL first.")
                );
                return;
            }

            var $submitBtn = dialog.$footer.find(".o_ace_git_submit_btn");
            $submitBtn
                .prop("disabled", true)
                .html(
                    '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> ' +
                        _t("Fetching...")
                );

            ajax.jsonRpc("/ssi_web_widget_ace_git/fetch_github", "call", {
                github_url: github_url,
                github_token: github_token || "",
            })
                .then(function (result) {
                    if (
                        result &&
                        result.content !== null &&
                        result.content !== undefined &&
                        !result.error
                    ) {
                        // Update the ACE session (aceSession is set by _startAce).
                        if (self.aceSession) {
                            self.aceSession.setValue(result.content);
                        } else if (self.aceEditor) {
                            self.aceEditor.setValue(result.content, -1);
                        }

                        // Mark field as changed in Odoo without waiting for
                        // the ACE 'change' debounce.
                        self._setValue(result.content);

                        dialog.close();

                        self.do_notify(
                            _t("Success"),
                            _t("File content successfully fetched from GitHub.")
                        );
                    } else {
                        var errorMsg =
                            (result && result.error) ||
                            _t("An unknown error occurred.");
                        self.do_warn(_t("Failed to Fetch File"), errorMsg);
                        $submitBtn
                            .prop("disabled", false)
                            .html(
                                '<i class="fa fa-github" aria-hidden="true"></i> ' +
                                    _t("Fetch & Apply")
                            );
                    }
                })
                .guardedCatch(function () {
                    self.do_warn(
                        _t("Error"),
                        _t(
                            "Failed to reach the backend server. " +
                                "Please check the server logs and try again."
                        )
                    );
                    $submitBtn
                        .prop("disabled", false)
                        .html(
                            '<i class="fa fa-github" aria-hidden="true"></i> ' +
                                _t("Fetch & Apply")
                        );
                });
        },
    });
});

odoo.define("ssi_web_widget_ace_git.AceGitWidget", function (require) {
    "use strict";

    var core = require("web.core");
    var ajax = require("web.ajax");
    var Dialog = require("web.Dialog");
    var basic_fields = require("web.basic_fields");
    var _t = core._t;

    // In Odoo 14, the ACE widget is "AceEditor" (registered in field registry
    // as 'ace'). It is NOT called "FieldCode".
    var AceEditor = basic_fields.AceEditor;
    if (!AceEditor) {
        return;
    }

    /**
     * Extend AceEditor to add a "Fetch dari GitHub" button below the editor
     * in edit mode.
     *
     * Key facts about AceEditor in Odoo 14:
     *  - Template "AceEditor" renders:
     *      <div class="oe_form_field o_ace_view_editor">   ← this.$el
     *          <div class="ace-view-editor"/>               ← ACE lives here
     *      </div>
     *  - AceEditor overrides _render() for BOTH modes (no _renderEdit /
     *    _renderReadonly split), so we hook into _render().
     *  - We use this.$el.after($btn) to place the button as a sibling,
     *    outside the editor's height-constrained div.
     *
     * Flow:
     *  1. User clicks button → _onClickFetchFromGitHub()
     *  2. Inline-HTML Dialog opens with URL + token inputs
     *  3. User clicks "Ambil & Terapkan" → _fetchAndInjectContent()
     *  4. ajax.jsonRpc → /ssi_web_widget_ace_git/fetch_github (backend proxy)
     *  5a. Success → aceEditor.setValue() + _setValue() → dialog.close()
     *  5b. Failure → do_warn() with backend error message
     */
    AceEditor.include({
        // ------------------------------------------------------------------
        // Rendering overrides
        // ------------------------------------------------------------------

        /**
         * AceEditor uses _render() for both edit and readonly modes.
         * After calling super, we add/remove the GitHub fetch button
         * depending on this.mode.
         *
         * @override
         */
        _render: function () {
            var self = this;
            var result = this._super.apply(this, arguments);

            // Remove any existing sibling button (prevent duplicates).
            this.$el.siblings(".o_ace_git_fetch_btn").remove();

            if (this.mode === "edit") {
                var $btn = $("<button>", {
                    type: "button",
                    class: "btn btn-sm btn-secondary o_ace_git_fetch_btn mt-1",
                    html:
                        '<i class="fa fa-github" aria-hidden="true"></i> ' +
                        _t("Fetch dari GitHub"),
                    title: _t("Ambil konten file dari GitHub dan masukkan ke editor"),
                }).on("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    self._onClickFetchFromGitHub();
                });

                this.$el.after($btn);
            }

            return result;
        },

        /**
         * Clean up the sibling button when the widget is destroyed.
         *
         * @override
         */
        destroy: function () {
            this.$el.siblings(".o_ace_git_fetch_btn").remove();
            this._super.apply(this, arguments);
        },

        // ------------------------------------------------------------------
        // Actions
        // ------------------------------------------------------------------

        /**
         * Handler for the "Fetch dari GitHub" button click.
         * Builds the dialog form HTML inline and opens a Dialog widget.
         */
        _onClickFetchFromGitHub: function () {
            var self = this;

            // Build the dialog form HTML inline (no separate QWeb template
            // needed — avoids the web.assets_qweb dependency).
            var $form = $(
                '<div class="o_ace_git_dialog_form">' +
                    '<div class="form-group mb-3">' +
                    '<label class="col-form-label font-weight-bold" for="ace_git_url">' +
                    _t("URL File GitHub") +
                    "</label>" +
                    '<input type="text" id="ace_git_url" name="ace_git_url"' +
                    ' class="form-control"' +
                    ' placeholder="https://github.com/user/repo/blob/main/path/to/file.py"' +
                    ' autocomplete="off" spellcheck="false"/>' +
                    '<small class="form-text text-muted">' +
                    _t(
                        "Mendukung URL GitHub web (/blob/) atau URL raw (raw.githubusercontent.com)."
                    ) +
                    "</small>" +
                    "</div>" +
                    '<div class="form-group mb-1">' +
                    '<label class="col-form-label font-weight-bold" for="ace_git_token">' +
                    _t("GitHub Personal Access Token") +
                    ' <span class="text-muted font-weight-normal">' +
                    _t("(opsional untuk repo publik)") +
                    "</span>" +
                    "</label>" +
                    '<input type="password" id="ace_git_token" name="ace_git_token"' +
                    ' class="form-control"' +
                    ' placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' +
                    ' autocomplete="new-password"/>' +
                    '<small class="form-text text-muted">' +
                    _t(
                        "Wajib diisi untuk repositori privat. Token tidak disimpan di server."
                    ) +
                    "</small>" +
                    "</div>" +
                    "</div>"
            );

            var dialog = new Dialog(self, {
                title: _t("Ambil File dari GitHub"),
                size: "medium",
                $content: $form,
                buttons: [
                    {
                        text: _t("Ambil & Terapkan"),
                        classes: "btn-primary o_ace_git_submit_btn",
                        click: function () {
                            var url = $form.find("#ace_git_url").val().trim();
                            var token = $form.find("#ace_git_token").val().trim();
                            self._fetchAndInjectContent(url, token, dialog);
                        },
                    },
                    {
                        text: _t("Batal"),
                        classes: "btn-secondary",
                        close: true,
                    },
                ],
            });

            dialog.open();

            // Allow submitting the form with Enter from the URL input.
            $form.find("#ace_git_url").on("keydown", function (ev) {
                if (ev.which === 13) {
                    ev.preventDefault();
                    dialog.$footer.find(".o_ace_git_submit_btn").trigger("click");
                }
            });
        },

        /**
         * Call the backend proxy to fetch the file from GitHub, then inject
         * the returned content into the active ACE editor.
         *
         * @param {String} github_url   - GitHub file URL entered by the user.
         * @param {String} github_token - Optional GitHub PAT.
         * @param {Dialog} dialog       - The open dialog instance (closed on success).
         */
        _fetchAndInjectContent: function (github_url, github_token, dialog) {
            var self = this;

            if (!github_url) {
                self.do_warn(
                    _t("Peringatan"),
                    _t("Harap masukkan URL file GitHub terlebih dahulu.")
                );
                return;
            }

            // Disable the submit button and show a loading indicator.
            var $submitBtn = dialog.$footer.find(".o_ace_git_submit_btn");
            $submitBtn
                .prop("disabled", true)
                .html(
                    '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> ' +
                        _t("Mengambil...")
                );

            ajax.jsonRpc("/ssi_web_widget_ace_git/fetch_github", "call", {
                github_url: github_url,
                github_token: github_token || "",
            })
                .then(function (result) {
                    if (
                        result &&
                        result.content !== null &&
                        result.content !== undefined &&
                        !result.error
                    ) {
                        // 1. Update the ACE session value (AceEditor stores
                        //    the session in this.aceSession, and the editor
                        //    in this.aceEditor — both are set by _startAce()).
                        if (self.aceSession) {
                            self.aceSession.setValue(result.content);
                        } else if (self.aceEditor) {
                            self.aceEditor.setValue(result.content, -1);
                        }

                        // 2. Directly mark the Odoo field as changed so the
                        //    value is committed without waiting for the ace
                        //    'change' debounce to fire.
                        self._setValue(result.content);

                        dialog.close();

                        self.do_notify(
                            _t("Berhasil"),
                            _t("Konten file berhasil diambil dari GitHub.")
                        );
                    } else {
                        var errorMsg =
                            (result && result.error) ||
                            _t("Terjadi kesalahan yang tidak diketahui.");
                        self.do_warn(_t("Gagal Mengambil File"), errorMsg);
                        // Re-enable the button so the user can retry.
                        $submitBtn
                            .prop("disabled", false)
                            .html(
                                '<i class="fa fa-github" aria-hidden="true"></i> ' +
                                    _t("Ambil & Terapkan")
                            );
                    }
                })
                .guardedCatch(function () {
                    self.do_warn(
                        _t("Error"),
                        _t(
                            "Gagal menghubungi server backend. " +
                                "Silakan periksa log server dan coba lagi."
                        )
                    );
                    $submitBtn
                        .prop("disabled", false)
                        .html(
                            '<i class="fa fa-github" aria-hidden="true"></i> ' +
                                _t("Ambil & Terapkan")
                        );
                });
        },
    });
});
