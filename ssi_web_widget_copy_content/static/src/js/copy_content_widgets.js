/** @odoo-module **/

odoo.define("ssi_web_widget_copy_content.CopyContentWidgets", function (require) {
    "use strict";

    var AbstractField = require("web.AbstractField");
    var fieldRegistry = require("web.field_registry");
    var core = require("web.core");
    var FieldMany2One = require("web.relational_fields").FieldMany2One;

    // Utility function to copy text to clipboard
    function copyTextToClipboard(text) {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            var successful = document.execCommand("copy");
            var msg = successful ? "successful" : "unsuccessful";
            console.log("Copying text command was " + msg);

            if (window.odoo && window.odoo.bus) {
                window.odoo.bus.trigger("do_notify", {
                    title: "Clipboard",
                    message: "Content copied to clipboard!",
                    sticky: false,
                    type: "success",
                });
            } else {
                console.warn("Odoo bus not found, cannot display notification.");
                alert("Content copied to clipboard!");
            }
        } catch (err) {
            console.error("Oops, unable to copy", err);
            if (window.odoo && window.odoo.bus) {
                window.odoo.bus.trigger("do_notify", {
                    title: "Clipboard Error",
                    message: "Failed to copy content to clipboard.",
                    sticky: false,
                    type: "danger",
                });
            } else {
                console.warn(
                    "Odoo bus not found, cannot display notification for error."
                );
                alert("Failed to copy content to clipboard.");
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // Mixin to add a copy button to fields
    var CopyButtonMixin = {
        _addCopyButton: function (valueToCopy) {
            this.$el.find(".o_copy_button").remove();
            this.$el.removeClass("o_with_copy_button");

            if (
                valueToCopy === null ||
                valueToCopy === undefined ||
                (typeof valueToCopy === "string" && valueToCopy.trim() === "")
            ) {
                return;
            }

            var $button = $("<button/>", {
                class: "o_copy_button fa fa-clipboard",
                type: "button",
                title:
                    "Copy " + (this.field.string || this.field.name) + " to clipboard",
                "data-tooltip":
                    "Copy " + (this.field.string || this.field.name) + " to clipboard",
                "aria-label":
                    "Copy " + (this.field.string || this.field.name) + " to clipboard",
            });

            $button.on("click", function (event) {
                event.stopPropagation();
                event.preventDefault();
                copyTextToClipboard(String(valueToCopy));
            });

            this.$el.addClass("o_with_copy_button");

            // --- PERUBAHAN UTAMA DI SINI ---
            // Kita menargetkan input.o_input karena itu yang kita lihat di DOM untuk M2O
            // Dan mempertahankan .o_input_base untuk field lain jika ada
            var $targetElement = this.$el
                .find(
                    "input.o_input, textarea.o_input, select.o_input, input.o_input_base, textarea.o_input_base, .o_field_many2one_selection, a.o_form_uri"
                )
                .last();

            if ($targetElement.length) {
                $targetElement.after($button);
            } else {
                this.$el.append($button);
            }
        },

        _removeCopyButton: function () {
            this.$el.find(".o_copy_button").remove();
            this.$el.removeClass("o_with_copy_button");
        },

        _getDisplayedValueToCopy: function () {
            return this.value;
        },
    };

    // --- Widget Definitions ---

    // Widget for Char, Text, Integer, Float (Basic Fields)
    var CopyBasicWidget = AbstractField.extend(CopyButtonMixin, {
        init: function () {
            this._super.apply(this, arguments);
            this.tagName = "div";
        },
        _render: function () {
            this.$el.empty();

            var value = this._getDisplayedValueToCopy();
            var text =
                value !== undefined && value !== null ? this._formatValue(value) : "";

            if (this.mode === "readonly") {
                var $span = $("<span>", {
                    class: "o_field_char o_field_widget",
                    text: text,
                });
                this.$el.append($span);
                this.$input = $span;
                this._removeCopyButton();
            } else {
                // Mode === 'edit'
                var type = "text";

                var $input = $("<input>", {
                    type: type,
                    class: "o_input",
                    value: text,
                });

                this.$input = $input;
                this.$el.append($input);

                this.$input.on(
                    "change",
                    function (event) {
                        this.value = this.parseValue(event.currentTarget.value, true);
                        this.trigger_up("field_changed", {
                            data_id: this.data_id,
                            changes: {[this.field.name]: this.value},
                            viewType: this.viewType,
                        });
                    }.bind(this)
                );

                this._addCopyButton(value);
            }
        },
    });

    // Widget for Many2one
    var CopyMany2oneWidget = FieldMany2One.extend(CopyButtonMixin, {
        _render: function () {
            this._super.apply(this, arguments);

            var valueToCopy = "";
            if (this.mode === "readonly") {
                var $a = this.$el.find("a");
                if ($a.length) {
                    valueToCopy = $a.text().trim();
                } else {
                    valueToCopy = this.$el.text().trim();
                }
                this._removeCopyButton();
            } else {
                // Mode === 'edit'
                // Dapatkan nilai dari input yang di-render oleh FieldMany2One
                // Menargetkan input.o_input seperti yang ditemukan di DOM
                var $input = this.$el.find("input.o_input");
                if ($input.length) {
                    valueToCopy = $input.val();
                } else if (
                    this.recordData[this.field.name] &&
                    this.recordData[this.field.name].data
                ) {
                    valueToCopy =
                        this.recordData[this.field.name].data.display_name || "";
                }
                this._addCopyButton(valueToCopy);
            }
        },
    });

    // Widget for Date and Datetime
    var CopyDateTimeWidget = AbstractField.extend(CopyButtonMixin, {
        _render: function () {
            this._super.apply(this, arguments);
            if (this.mode === "edit") {
                this._addCopyButton(this.value ? this._formatValue(this.value) : "");
            } else {
                this._removeCopyButton();
            }
        },
    });

    // Widget for Selection
    var CopySelectionWidget = AbstractField.extend(CopyButtonMixin, {
        _render: function () {
            this._super.apply(this, arguments);
            if (this.mode === "edit") {
                this._addCopyButton(this.value ? this._formatValue(this.value) : "");
            } else {
                this._removeCopyButton();
            }
        },
    });

    // Widget for Reference
    var CopyReferenceWidget = AbstractField.extend(CopyButtonMixin, {
        _render: function () {
            this._super.apply(this, arguments);
            var valueToCopy = "";
            if (this.mode === "readonly") {
                var $a = this.$el.find("a");
                if ($a.length) {
                    valueToCopy = $a.text().trim();
                } else if (
                    this.recordData[this.field.name] &&
                    this.recordData[this.field.name].data
                ) {
                    valueToCopy =
                        this.recordData[this.field.name].data.display_name || "";
                } else if (this.value && this.value[2]) {
                    valueToCopy = this.value[2];
                } else {
                    valueToCopy = this.$el.text().trim();
                }
                this._removeCopyButton();
            } else {
                var $input = this.$el.find("input"); // Ini mungkin juga perlu disesuaikan jika input referensi berbeda
                if ($input.length) {
                    valueToCopy = $input.val();
                } else if (
                    this.recordData[this.field.name] &&
                    this.recordData[this.field.name].data
                ) {
                    valueToCopy =
                        this.recordData[this.field.name].data.display_name || "";
                }
                this._addCopyButton(valueToCopy);
            }
        },
    });

    // --- Widget Registration ---
    fieldRegistry.add("copy_char_widget", CopyBasicWidget);
    fieldRegistry.add("copy_integer_widget", CopyBasicWidget);
    fieldRegistry.add("copy_float_widget", CopyBasicWidget);
    fieldRegistry.add("copy_many2one_widget", CopyMany2oneWidget);
    fieldRegistry.add("copy_date_widget", CopyDateTimeWidget);
    fieldRegistry.add("copy_datetime_widget", CopyDateTimeWidget);
    fieldRegistry.add("copy_selection_widget", CopySelectionWidget);
    fieldRegistry.add("copy_reference_widget", CopyReferenceWidget);

    return {
        CopyBasicWidget: CopyBasicWidget,
        CopyMany2oneWidget: CopyMany2oneWidget,
        CopyDateTimeWidget: CopyDateTimeWidget,
        CopySelectionWidget: CopySelectionWidget,
        CopyReferenceWidget: CopyReferenceWidget,
    };
});
