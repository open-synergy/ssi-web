/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {Component, useState} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";

/**
 * Renders a single JSON value as part of the read-only tree built by
 * `JsonViewerField`. Scalars (string/number/boolean/null) are rendered
 * inline; objects/arrays render their entries recursively by mounting a
 * `JsonViewerNode` for each child value, so every non-root complex node
 * owns its own expand/collapse state.
 */
export class JsonViewerNode extends Component {
    static template = "ssi_web_widget_json.JsonViewerNode";
    static components = {JsonViewerNode};
    static props = ["value", "isRoot?"];
    static defaultProps = {
        isRoot: false,
    };

    setup() {
        this.state = useState({collapsed: false});
    }

    get isComplex() {
        return this.props.value !== null && typeof this.props.value === "object";
    }

    get isArray() {
        return Array.isArray(this.props.value);
    }

    get quotedValue() {
        return `"${this.props.value}"`;
    }

    /**
     * @returns {Array<[string|number, *]>} `[key, value]` pairs — index-based
     *   for arrays, `Object.entries` for plain objects.
     */
    get entries() {
        if (!this.isComplex) {
            return [];
        }
        if (this.isArray) {
            return this.props.value.map((item, index) => [index, item]);
        }
        return Object.entries(this.props.value);
    }

    get emptyBraces() {
        return this.isArray ? "[]" : "{}";
    }

    /**
     * @param {string|number} key
     * @returns {String}
     */
    keyLabel(key) {
        return this.isArray ? `[${key}]` : String(key);
    }

    get summary() {
        const count = this.entries.length;
        if (this.isArray) {
            return count === 1 ? _t("[1 item]") : _t("[%s items]", count);
        }
        return count === 1 ? _t("{1 key}") : _t("{%s keys}", count);
    }

    get toggleTitle() {
        return this.state.collapsed ? _t("Expand") : _t("Collapse");
    }

    toggle() {
        this.state.collapsed = !this.state.collapsed;
    }
}
