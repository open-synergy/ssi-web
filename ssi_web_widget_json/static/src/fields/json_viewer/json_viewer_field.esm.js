/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component, useEffect, useRef, useState} from "@odoo/owl";
import {JsonViewerNode} from "./json_viewer_node.esm";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {standardFieldProps} from "@web/views/fields/standard_field_props";

/**
 * JSON Viewer field widget.
 *
 * Read-only mode : renders JSON as an interactive, expandable/collapsible
 *                  tree via `JsonViewerNode`.
 * Edit mode      : renders a monospace textarea with real-time
 *                  valid/invalid JSON feedback.
 *
 * Usage in XML view:
 *   <field name="my_text_field" widget="json_viewer"/>
 */
export class JsonViewerField extends Component {
    static template = "ssi_web_widget_json.JsonViewerField";
    static components = {JsonViewerNode};
    static props = {
        ...standardFieldProps,
    };

    setup() {
        this.textareaRef = useRef("textarea");
        this.state = useState({statusText: "", statusClass: ""});

        // (Re)initialize the textarea whenever the field switches into edit
        // mode. The textarea is intentionally left uncontrolled afterwards
        // (no reactive `t-att-value`) so live typing is never overwritten by
        // a re-render triggered by the validation badge.
        useEffect(
            () => {
                if (!this.props.readonly && this.textareaRef.el) {
                    const initial = this.formatForEdit(this.value);
                    this.textareaRef.el.value = initial;
                    this.updateValidation(initial);
                }
            },
            () => [this.props.readonly]
        );
    }

    // ------------------------------------------------------------------
    // Getters
    // ------------------------------------------------------------------

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    get emptyLabel() {
        return _t("(empty)");
    }

    /**
     * @returns {{ok: boolean, data: *}} parse result of the current value.
     */
    get parsedValue() {
        try {
            return {ok: true, data: JSON.parse(this.value)};
        } catch {
            return {ok: false, data: undefined};
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * @param {String} rawValue
     * @returns {String} pretty-printed JSON, or the raw value unchanged if
     *   it isn't valid JSON.
     */
    formatForEdit(rawValue) {
        if (!rawValue) {
            return "";
        }
        try {
            return JSON.stringify(JSON.parse(rawValue), null, 2);
        } catch {
            return rawValue;
        }
    }

    /**
     * Update the valid/invalid JSON badge for the current textarea content.
     * @param {String} rawValue
     */
    updateValidation(rawValue) {
        if (!rawValue) {
            this.state.statusText = "";
            this.state.statusClass = "";
            return;
        }
        try {
            JSON.parse(rawValue);
            this.state.statusText = `✓ ${_t("Valid JSON")}`;
            this.state.statusClass = "o_json_valid";
        } catch (error) {
            this.state.statusText = `✗ ${_t("Invalid JSON")}: ${error.message}`;
            this.state.statusClass = "o_json_invalid";
        }
    }

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------

    /**
     * Update the validation badge and propagate the raw value on every
     * keystroke.
     * @param {InputEvent} ev
     */
    onInput(ev) {
        const raw = ev.target.value;
        this.updateValidation(raw);
        this.props.record.update({[this.props.name]: raw});
    }

    /**
     * Insert 4 spaces on Tab instead of moving focus to the next field.
     * @param {KeyboardEvent} ev
     */
    onKeydown(ev) {
        if (ev.key !== "Tab") {
            return;
        }
        ev.preventDefault();
        const el = ev.target;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const indent = "    ";
        el.value = el.value.slice(0, start) + indent + el.value.slice(end);
        el.selectionStart = el.selectionEnd = start + indent.length;
        this.onInput({target: el});
    }
}

export const jsonViewerField = {
    component: JsonViewerField,
    displayName: _t("JSON Viewer"),
    supportedTypes: ["text", "char"],
};

registry.category("fields").add("json_viewer", jsonViewerField);
