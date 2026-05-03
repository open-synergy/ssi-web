// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

odoo.define("ssi_web_widget_rjsf.RjsfWidget", function (require) {
    "use strict";

    var AbstractField = require("web.AbstractField");
    var fieldRegistry = require("web.field_registry");
    var core = require("web.core");

    var _t = core._t;

    /**
     * RJSF JSON Data Schema Widget  (``rjsf``)
     *
     * Renders a ``Text`` or ``Char`` field that stores JSON using
     * React JSON Schema Form (RJSF v5) in edit mode, and as a formatted
     * JSON block in read-only mode.
     *
     * The JSON schema (and optional uiSchema) must be provided via the
     * ``options`` attribute in the field view definition:
     *
     *   <field name="json_data" widget="rjsf"
     *          options='{"schema": {"type":"object","properties":{"name":{"type":"string"}}},
     *                   "uiSchema": {}}'/>
     *
     * Widget options:
     *   schema_field (string, optional) — Name of a sibling field whose value contains
     *                                     the JSON Schema string. Evaluated dynamically
     *                                     at render time; widget re-renders when the
     *                                     source field changes.
     *   schema   (object, optional) — Static JSON Schema object. Used when
     *                                 ``schema_field`` is not set.
     *   uiSchema (object, optional) — RJSF uiSchema for UI customization.
     *   liveValidate (boolean, optional, default false) — validate on every change.
     *   omitExtraData (boolean, optional, default false) — strip keys not in schema.
     */
    var RjsfWidget = AbstractField.extend({
        className: "o_field_rjsf",
        supportedFieldTypes: ["text", "char"],
        tagName: "div",

        // ------------------------------------------------------------------
        // Lifecycle
        // ------------------------------------------------------------------

        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            // Direct reference to the React root DOM container.
            this._reactContainer = null;
            // Keep a reference to the parsed formData to avoid repeated JSON.parse.
            this._formData = null;
            // Track the last rendered schema (JSON string) to skip unnecessary re-renders.
            this._lastSchemaStr = null;
            // When schema comes from another field, re-render only when that field changes.
            // NOTE: resetOnAnyFieldChange causes render storms on 50+ field forms.
            // We handle re-render via fieldDependencies check in reset() instead.
            if (this.nodeOptions && this.nodeOptions.schema_field) {
                this.resetOnAnyFieldChange = true;
            }
        },

        /**
         * @override
         */
        destroy: function () {
            this._unmountReact();
            this._super.apply(this, arguments);
        },

        // ------------------------------------------------------------------
        // Rendering
        // ------------------------------------------------------------------

        /**
         * @override
         */
        _renderEdit: function () {
            var config = this._getSchemaConfig();
            var schema = config.schema;
            var schemaStr = schema ? JSON.stringify(schema) : null;

            // Skip re-mount if schema hasn't changed and React is already mounted.
            if (
                schemaStr &&
                schemaStr === this._lastSchemaStr &&
                this._reactContainer
            ) {
                return;
            }
            this._lastSchemaStr = schemaStr;

            // Unmount previous React instance before clearing DOM.
            this._unmountReact();
            this.$el.empty();

            if (!schema || typeof schema !== "object") {
                this.$el.append(
                    $("<div>", {class: "o_rjsf_no_schema"}).html(
                        _t(
                            "<b>rjsf widget:</b> no valid <code>schema</code> found. " +
                                'Either set <code>options=\'{"schema_field":"field_name"}\'</code> ' +
                                "to read from another field, or provide a static " +
                                "<code>options='{\"schema\":{...}}'</code> " +
                                "to the field view definition."
                        )
                    )
                );
                return;
            }

            // Build the React container div.
            var $container = $("<div>", {
                class: "o_rjsf_form_container",
            });
            this.$el.append($container);
            this._reactContainer = $container[0];

            // Parse current JSON value as formData.
            this._formData = this._parseValue(this.value);

            // Mount RJSF form into the container.
            this._mountReact(config, this._formData);
        },

        /**
         * @override
         */
        _renderReadonly: function () {
            this._unmountReact();
            this._lastSchemaStr = null;
            // Reset cached schema string so next edit mode will re-mount React fresh.
            this.$el.empty();

            if (!this.value) {
                this.$el.append(
                    $("<span>", {class: "o_rjsf_empty"}).text(_t("(empty)"))
                );
                return;
            }

            var $wrapper = $("<div>", {class: "o_rjsf_readonly_container"});
            try {
                var parsed = JSON.parse(this.value);
                $wrapper.append($("<pre>").text(JSON.stringify(parsed, null, 2)));
            } catch (e) {
                // Not valid JSON — show raw text.
                $wrapper.append($("<pre>").text(this.value));
            }
            this.$el.append($wrapper);
        },

        // ------------------------------------------------------------------
        // React mounting helpers
        // ------------------------------------------------------------------

        /**
         * Mount (or re-mount) the RJSF Form into the React container.
         *
         * @param {Object} config    - Schema config: {schema, uiSchema, liveValidate, omitExtraData}.
         * @param {*}      formData  - Parsed current value (may be null/undefined).
         * @private
         */
        _mountReact: function (config, formData) {
            var self = this;
            var container = this._reactContainer;
            if (!container) {
                return;
            }

            // Ensure the RJSF bundle is available.
            if (
                !window.RJSFBundle ||
                !window.RJSFBundle.React ||
                !window.RJSFBundle.Form
            ) {
                container.innerHTML =
                    '<div class="o_rjsf_error">' +
                    _t("RJSF bundle not loaded. Check static assets.") +
                    "</div>";
                return;
            }

            var React = window.RJSFBundle.React;
            var ReactDOM = window.RJSFBundle.ReactDOM;
            var Form = window.RJSFBundle.Form;
            var ajv8Validator = window.RJSFBundle.validator;

            // Extract form props from config, falling back to widget nodeOptions.
            var schema = config.schema;
            var uiSchema = config.uiSchema || {};
            var liveValidate = config.liveValidate || false;
            var omitExtraData = config.omitExtraData || false;

            /**
             * OnChange handler: propagate formData back to Odoo field value.
             *
             * @param {Object} evt - RJSF change event with formData and errors.
             */
            function handleChange(evt) {
                var json = "";
                try {
                    json = JSON.stringify(evt.formData);
                } catch (e) {
                    json = "";
                }
                self._setValue(json);
            }

            // Build the Form element using React.createElement (no JSX).
            var formElement = React.createElement(Form, {
                schema: schema,
                uiSchema: uiSchema,
                formData: formData,
                validator: ajv8Validator,
                liveValidate: liveValidate,
                omitExtraData: omitExtraData,
                onChange: handleChange,
                // Prevent native form submission from propagating up the page.
                onSubmit: function (evt) {
                    if (evt.event) {
                        evt.event.preventDefault();
                    }
                },
                // Children: hide the default Submit button via CSS
                // (we commit changes on every onChange instead).
            });

            ReactDOM.render(formElement, container);
        },

        /**
         * Unmount the React component if it was mounted.
         * @private
         */
        _unmountReact: function () {
            var container = this._reactContainer;
            if (container && window.RJSFBundle && window.RJSFBundle.ReactDOM) {
                window.RJSFBundle.ReactDOM.unmountComponentAtNode(container);
            }
            this._reactContainer = null;
        },

        // ------------------------------------------------------------------
        // Value helpers
        // ------------------------------------------------------------------

        /**
         * Parse a JSON string into a plain object/value.
         * Returns null when the string is empty or invalid.
         *
         * @param {String} raw
         * @returns {*}
         * @private
         */
        _parseValue: function (raw) {
            if (!raw) {
                return undefined;
            }
            try {
                return JSON.parse(raw);
            } catch (e) {
                return undefined;
            }
        },

        /**
         * Get the full schema configuration to use for the RJSF form.
         *
         * The field value (or static option) may be either:
         *   - A raw JSON Schema:  ``{"type":"object","properties":{...}}``
         *   - A config wrapper:   ``{"schema":{...},"uiSchema":{...},"omitExtraData":true,...}``
         *
         * Config-wrapper keys (all optional except ``schema``):
         *   schema, uiSchema, liveValidate, omitExtraData
         *
         * Widget nodeOptions are used as fallback defaults.
         *
         * Priority:
         *   1. ``schema_field`` option — parse the value of the named sibling field.
         *   2. ``schema`` option — use the static object provided in the view.
         *
         * @returns {Object} Schema config with schema, uiSchema, liveValidate, omitExtraData fields.
         * @private
         */
        _getSchemaConfig: function () {
            var result = {
                schema: null,
                uiSchema: this._getOption("uiSchema", {}),
                liveValidate: this._getOption("liveValidate", false),
                omitExtraData: this._getOption("omitExtraData", false),
            };

            var schemaField = this._getOption("schema_field", null);
            if (schemaField) {
                var raw =
                    this.record && this.record.data && this.record.data[schemaField];
                if (!raw) {
                    return result;
                }
                var parsed = null;
                try {
                    parsed = JSON.parse(raw);
                } catch (e) {
                    return result;
                }
                if (parsed && typeof parsed === "object") {
                    if (parsed.schema && typeof parsed.schema === "object") {
                        // Config-wrapper format: {schema:{...}, uiSchema?:{...}, ...}
                        result.schema = parsed.schema;
                        if (parsed.uiSchema && typeof parsed.uiSchema === "object") {
                            result.uiSchema = parsed.uiSchema;
                        }
                        if (typeof parsed.liveValidate !== "undefined") {
                            result.liveValidate = Boolean(parsed.liveValidate);
                        }
                        if (typeof parsed.omitExtraData !== "undefined") {
                            result.omitExtraData = Boolean(parsed.omitExtraData);
                        }
                    } else {
                        // Direct JSON Schema format: {"type":"object","properties":{...}}
                        result.schema = parsed;
                    }
                }
                return result;
            }

            result.schema = this._getOption("schema", null);
            return result;
        },

        /**
         * Backward-compat helper — returns just the schema object (or null).
         * @returns {Object|null}
         * @private
         */
        _getSchema: function () {
            return this._getSchemaConfig().schema;
        },

        /**
         * Read a widget option by key with a fallback default.
         *
         * @param {String} key
         * @param {*}      defaultValue
         * @returns {*}
         * @private
         */
        _getOption: function (key, defaultValue) {
            var opts = this.nodeOptions || {};
            return Object.prototype.hasOwnProperty.call(opts, key)
                ? opts[key]
                : defaultValue;
        },

        // ------------------------------------------------------------------
        // Odoo change commit
        // ------------------------------------------------------------------

        /**
         * Ensure any pending React state is committed before saving.
         * @override
         */
        commitChanges: function () {
            // Changes are already committed on every RJSF onChange event.
            // Nothing additional is needed here.
        },
    });

    fieldRegistry.add("rjsf", RjsfWidget);

    return RjsfWidget;
});
