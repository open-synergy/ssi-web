odoo.define("ssi_web_show_hide_password.show_hide_password", function (require) {
    "use strict";

    /**
     * Universal show/hide (eye) toggle for every password input.
     *
     * The script deliberately works at DOM level only: it never
     * includes, patches or extends a core Odoo widget. Overriding
     * widgets such as `web.ChangePassword` or
     * `web.basic_fields.InputField` breaks the `.include()` chain of
     * every other module touching the same widget, which is the exact
     * failure this module exists to avoid.
     *
     * A single `MutationObserver` installed on the document catches
     * password inputs rendered at any moment -- the public login page,
     * the Change Password dialog, form views and wizards alike.
     */

    var translation = require("web.translation");

    var _t = translation._t;

    // Marker written on an input once it owns a toggle, so that a
    // later DOM mutation never decorates the same input twice.
    var PROCESSED_ATTRIBUTE = "data-o-show-hide-password";
    var WRAPPER_CLASS = "o_show_hide_password_wrapper";
    var TOGGLE_CLASS = "o_show_hide_password_toggle";
    var HIDDEN_ICON_CLASS = "fa-eye";
    var SHOWN_ICON_CLASS = "fa-eye-slash";
    var PENDING_SELECTOR = 'input[type="password"]:not([' + PROCESSED_ATTRIBUTE + "])";

    /**
     * Build the clickable eye element of a single password input.
     *
     * @returns {HTMLElement} the detached `<i>` toggle, in its
     *      "password is hidden" state.
     */
    function buildToggle() {
        var toggle = document.createElement("i");
        toggle.className = "fa " + HIDDEN_ICON_CLASS + " " + TOGGLE_CLASS;
        toggle.setAttribute("role", "button");
        toggle.setAttribute("tabindex", "-1");
        toggle.setAttribute("aria-label", _t("Show password"));
        toggle.setAttribute("title", _t("Show password"));
        return toggle;
    }

    /**
     * Flip the readability of `input` and repaint its toggle.
     *
     * Only the `type` attribute and the icon classes are touched. No
     * `input` nor `change` event is dispatched, so widgets listening
     * on the field -- the `auth_password_policy` strength meter, for
     * instance -- keep seeing the value they already know about.
     *
     * @param {HTMLInputElement} input the decorated password input.
     * @param {HTMLElement} toggle the eye element bound to `input`.
     * @param {MouseEvent} ev the originating click.
     */
    function onToggleClick(input, toggle, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var wasHidden = input.getAttribute("type") === "password";
        input.setAttribute("type", wasHidden ? "text" : "password");
        toggle.classList.toggle(HIDDEN_ICON_CLASS, !wasHidden);
        toggle.classList.toggle(SHOWN_ICON_CLASS, wasHidden);
        var label = wasHidden ? _t("Hide password") : _t("Show password");
        toggle.setAttribute("aria-label", label);
        toggle.setAttribute("title", label);
    }

    /**
     * Give `input` its own toggle, wrapping it in a positioned span.
     *
     * The input is moved inside a brand new
     * `span.o_show_hide_password_wrapper` and nothing else about it is
     * altered: no attribute of the input is rewritten and no sibling
     * of the original parent is reordered. Wrapping is used instead of
     * appending to the existing parent because the surrounding markup
     * varies wildly (native login form, `<td>` of the Change Password
     * dialog, `.o_field_widget` of a form view) and cannot be assumed
     * to tolerate a second child.
     *
     * The call is idempotent: an input already carrying
     * `data-o-show-hide-password` is left untouched.
     *
     * @param {HTMLInputElement} input the password input to decorate.
     */
    function decorate(input) {
        if (input.getAttribute(PROCESSED_ATTRIBUTE)) {
            return;
        }
        var parent = input.parentNode;
        if (!parent) {
            return;
        }
        input.setAttribute(PROCESSED_ATTRIBUTE, "1");
        var wrapper = document.createElement("span");
        wrapper.className = WRAPPER_CLASS;
        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        var toggle = buildToggle();
        toggle.addEventListener("click", onToggleClick.bind(null, input, toggle));
        wrapper.appendChild(toggle);
    }

    /**
     * Decorate every still undecorated password input under `root`.
     *
     * @param {Node} root the subtree to scan; nodes without
     *      `querySelectorAll` (text nodes, comments) are ignored.
     */
    function decorateAll(root) {
        if (!root || !root.querySelectorAll) {
            return;
        }
        var inputs = root.querySelectorAll(PENDING_SELECTOR);
        for (var i = 0; i < inputs.length; i++) {
            decorate(inputs[i]);
        }
    }

    /**
     * Decorate the password inputs brought in by a mutation batch.
     *
     * Only added nodes are inspected, which keeps the observer cheap
     * on a busy backend and makes it immune to the mutations the
     * module itself produces while wrapping an input.
     *
     * @param {MutationRecord[]} mutations the observed batch.
     */
    function onMutations(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var node = added[j];
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches(PENDING_SELECTOR)) {
                        decorate(node);
                    }
                    decorateAll(node);
                }
            }
        }
    }

    var observer = new MutationObserver(onMutations);

    /**
     * Decorate what is already rendered, then watch for the rest.
     *
     * Observation is rooted on `document.documentElement` rather than
     * on `document.body` so that the very first backend render, which
     * replaces the whole body content, is caught as well.
     */
    function start() {
        decorateAll(document);
        observer.observe(document.documentElement, {childList: true, subtree: true});
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    return {
        PROCESSED_ATTRIBUTE: PROCESSED_ATTRIBUTE,
        WRAPPER_CLASS: WRAPPER_CLASS,
        TOGGLE_CLASS: TOGGLE_CLASS,
        HIDDEN_ICON_CLASS: HIDDEN_ICON_CLASS,
        SHOWN_ICON_CLASS: SHOWN_ICON_CLASS,
        decorate: decorate,
        decorateAll: decorateAll,
        start: start,
    };
});
