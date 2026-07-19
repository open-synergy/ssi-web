/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    Component,
    onMounted,
    onWillUnmount,
    onWillUpdateProps,
    useRef,
} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {standardFieldProps} from "@web/views/fields/standard_field_props";

/**
 * RJSF JSON Data Schema field widget (``rjsf``).
 *
 * Renders a ``json`` field using React JSON Schema Form (RJSF v5) in edit
 * mode, and as a formatted JSON block in read-only mode. The RJSF/React
 * bundle (``static/lib/rjsf-bundle.js``) is mounted/unmounted imperatively
 * on a single DOM element owned by this component; no OWL reactivity is
 * used inside that element.
 *
 * The JSON Schema is resolved from one of two sources, in priority order:
 *   1. ``schema_field`` option — name of a sibling field whose value holds
 *      the JSON Schema (as a JSON string or, if the sibling is itself a
 *      ``json`` field, as an already-parsed object). Re-resolved whenever
 *      that field's value changes.
 *   2. ``schema`` option — a static JSON Schema object declared in the
 *      view.
 *
 * Usage in XML view:
 *   <field name="json_data" widget="rjsf" options="{'schema': {...}}"/>
 *   <field name="json_data" widget="rjsf" options="{'schema_field': 'schema_char'}"/>
 */
export class RjsfField extends Component {
    static template = "ssi_web_widget_rjsf.RjsfField";
    static props = {
        ...standardFieldProps,
        schema: {type: Object, optional: true},
        schemaField: {type: String, optional: true},
        uiSchema: {type: Object, optional: true},
        liveValidate: {type: Boolean, optional: true},
        omitExtraData: {type: Boolean, optional: true},
    };
    static defaultProps = {
        uiSchema: {},
        liveValidate: false,
        omitExtraData: false,
    };

    setup() {
        this.rootRef = useRef("root");
        // Container that currently owns the mounted React tree, or null.
        this._reactContainer = null;
        // Identity of the schema+record currently mounted; used to skip
        // unnecessary remounts (which would reset RJSF's own edit state).
        this._mountedKey = null;

        onMounted(() => this._syncContent(this.props));
        onWillUpdateProps((nextProps) => this._syncContent(nextProps));
        onWillUnmount(() => this._unmountReact());
    }

    // ------------------------------------------------------------------
    // Schema resolution
    // ------------------------------------------------------------------

    /**
     * @param {Object} props
     * @returns {{schema: Object|null, uiSchema: Object, liveValidate: Boolean, omitExtraData: Boolean}}
     */
    _resolveSchemaConfig(props) {
        const config = {
            schema: null,
            uiSchema: props.uiSchema || {},
            liveValidate: Boolean(props.liveValidate),
            omitExtraData: Boolean(props.omitExtraData),
        };

        if (props.schemaField) {
            const raw = props.record.data[props.schemaField];
            config.schema = this._parseSchemaSource(raw);
            return config;
        }

        if (props.schema && typeof props.schema === "object") {
            config.schema = props.schema;
        }
        return config;
    }

    /**
     * Accepts either an already-parsed object (e.g. sibling ``json`` field)
     * or a JSON string (e.g. sibling ``char``/``text`` field).
     *
     * @param {*} raw
     * @returns {Object|null}
     */
    _parseSchemaSource(raw) {
        if (!raw) {
            return null;
        }
        if (typeof raw === "object") {
            return raw;
        }
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === "object" ? parsed : null;
            } catch {
                return null;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Content sync (readonly text / no-schema message / React mount)
    // ------------------------------------------------------------------

    /**
     * @param {Object} props
     */
    _syncContent(props) {
        const el = this.rootRef.el;
        if (!el) {
            return;
        }

        if (props.readonly) {
            this._unmountReact();
            this._renderReadonly(el, props);
            return;
        }

        const config = this._resolveSchemaConfig(props);
        if (!config.schema) {
            this._unmountReact();
            this._renderNoSchema(el);
            return;
        }

        const recordKey = String(props.record.resId ?? props.record.id ?? "new");
        const mountKey = `${recordKey}::${JSON.stringify(config.schema)}`;
        if (mountKey === this._mountedKey && this._reactContainer === el) {
            // Same record + same schema already mounted: leave the RJSF
            // form's own edit state untouched (do not overwrite it with
            // the last committed value).
            return;
        }

        this._mountReact(el, config, props.record.data[props.name]);
        this._mountedKey = mountKey;
    }

    /**
     * @param {HTMLElement} el
     * @param {Object} props
     */
    _renderReadonly(el, props) {
        el.textContent = "";
        const value = props.record.data[props.name];
        const pre = document.createElement("pre");
        pre.className = "o_rjsf_readonly_json";
        pre.textContent = value ? JSON.stringify(value, null, 2) : _t("(empty)");
        el.appendChild(pre);
    }

    /**
     * @param {HTMLElement} el
     */
    _renderNoSchema(el) {
        el.textContent = "";
        this._mountedKey = null;
        const div = document.createElement("div");
        div.className = "o_rjsf_no_schema";
        div.textContent = _t(
            "rjsf widget: no valid schema found. Either set the " +
                "schema_field option to read from another field, or " +
                "provide a static schema option in the view definition."
        );
        el.appendChild(div);
    }

    // ------------------------------------------------------------------
    // React mount helpers
    // ------------------------------------------------------------------

    /**
     * @param {HTMLElement} el
     * @param {Object} config
     * @param {*} formData
     */
    _mountReact(el, config, formData) {
        this._unmountReact();
        el.textContent = "";

        const bundle = window.RJSFBundle;
        if (!bundle || !bundle.React || !bundle.ReactDOM || !bundle.Form) {
            const div = document.createElement("div");
            div.className = "o_rjsf_error";
            div.textContent = _t("RJSF bundle not loaded. Check static assets.");
            el.appendChild(div);
            return;
        }

        const container = document.createElement("div");
        container.className = "o_rjsf_form_container";
        el.appendChild(container);

        const {React, ReactDOM, Form, validator} = bundle;
        const formElement = React.createElement(Form, {
            schema: config.schema,
            uiSchema: config.uiSchema,
            formData: formData || undefined,
            validator: validator,
            liveValidate: config.liveValidate,
            omitExtraData: config.omitExtraData,
            onChange: (evt) => this._onFormChange(evt),
            onSubmit: (evt) => {
                if (evt.event) {
                    evt.event.preventDefault();
                }
            },
        });
        ReactDOM.render(formElement, container);
        this._reactContainer = el;
    }

    _unmountReact() {
        if (this._reactContainer) {
            const container = this._reactContainer.querySelector(
                ".o_rjsf_form_container"
            );
            if (container && window.RJSFBundle && window.RJSFBundle.ReactDOM) {
                window.RJSFBundle.ReactDOM.unmountComponentAtNode(container);
            }
        }
        this._reactContainer = null;
        this._mountedKey = null;
    }

    /**
     * @param {{formData: *}} evt
     */
    _onFormChange(evt) {
        this.props.record.update({[this.props.name]: evt.formData});
    }
}

export const rjsfField = {
    component: RjsfField,
    displayName: _t("RJSF JSON Schema Form"),
    supportedTypes: ["json"],
    supportedOptions: [
        {
            label: _t("Schema field"),
            name: "schema_field",
            type: "field",
            help: _t(
                "Name of a sibling field holding the JSON Schema. Takes " +
                    "priority over the static schema option."
            ),
        },
        {
            label: _t("Schema"),
            name: "schema",
            type: "string",
            help: _t(
                "Static JSON Schema object literal used when schema_field is not set."
            ),
        },
        {
            label: _t("UI Schema"),
            name: "uiSchema",
            type: "string",
            help: _t("RJSF uiSchema object literal for UI customization."),
        },
        {
            label: _t("Live validate"),
            name: "liveValidate",
            type: "boolean",
            default: false,
            help: _t("Validate the form against the schema on every change."),
        },
        {
            label: _t("Omit extra data"),
            name: "omitExtraData",
            type: "boolean",
            default: false,
            help: _t("Strip keys not described in the schema on change."),
        },
    ],
    extractProps: ({options}) => ({
        schema: options.schema || undefined,
        schemaField: options.schema_field || undefined,
        uiSchema: options.uiSchema || {},
        liveValidate: Boolean(options.liveValidate),
        omitExtraData: Boolean(options.omitExtraData),
    }),
};

registry.category("fields").add("rjsf", rjsfField);
