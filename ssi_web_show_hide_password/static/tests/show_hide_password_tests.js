odoo.define("ssi_web_show_hide_password.show_hide_password_tests", function (require) {
    "use strict";
    /* global QUnit*/

    var showHidePassword = require("ssi_web_show_hide_password.show_hide_password");

    var WRAPPER_SELECTOR = "." + showHidePassword.WRAPPER_CLASS;
    var TOGGLE_SELECTOR = "." + showHidePassword.TOGGLE_CLASS;

    /**
     * Return the QUnit fixture element used as a fake render target.
     *
     * @returns {HTMLElement} the `#qunit-fixture` container.
     */
    function fixture() {
        return document.getElementById("qunit-fixture");
    }

    /**
     * Yield long enough for the MutationObserver callback to have run.
     *
     * Observer callbacks are delivered as microtasks, so a single
     * macrotask hop is enough and keeps the test free of arbitrary
     * timeouts.
     *
     * @returns {Promise} resolved once pending microtasks are flushed.
     */
    function nextTick() {
        return new Promise(function (resolve) {
            setTimeout(resolve, 0);
        });
    }

    /**
     * Render `count` password inputs into the fixture, as a form would.
     *
     * @param {Number} count how many `input[type=password]` to insert.
     * @returns {Promise} resolved once the observer processed them.
     */
    function renderPasswordInputs(count) {
        var markup = "";
        for (var i = 0; i < count; i++) {
            markup += '<input type="password" class="test_password"/>';
        }
        fixture().innerHTML = markup;
        return nextTick();
    }

    QUnit.module(
        "ssi_web_show_hide_password",
        {
            afterEach: function () {
                // The Odoo QUnit harness fails any test leaving nodes
                // behind in the fixture.
                fixture().innerHTML = "";
            },
        },
        function () {
            QUnit.test(
                "a password input added to the DOM gets a toggle",
                async function (assert) {
                    assert.expect(4);

                    await renderPasswordInputs(1);

                    var input = fixture().querySelector("input.test_password");
                    assert.strictEqual(
                        input.getAttribute(showHidePassword.PROCESSED_ATTRIBUTE),
                        "1",
                        "the input is flagged as processed"
                    );
                    assert.strictEqual(
                        fixture().querySelectorAll(WRAPPER_SELECTOR).length,
                        1,
                        "the input has been wrapped exactly once"
                    );
                    assert.strictEqual(
                        input.parentNode.className,
                        showHidePassword.WRAPPER_CLASS,
                        "the input now lives inside the wrapper"
                    );
                    assert.strictEqual(
                        fixture().querySelectorAll(TOGGLE_SELECTOR).length,
                        1,
                        "exactly one toggle has been inserted"
                    );
                }
            );

            QUnit.test(
                "clicking the toggle switches the input type back and forth",
                async function (assert) {
                    assert.expect(5);

                    await renderPasswordInputs(1);

                    var input = fixture().querySelector("input.test_password");
                    var toggle = fixture().querySelector(TOGGLE_SELECTOR);
                    assert.strictEqual(
                        input.getAttribute("type"),
                        "password",
                        "the value starts hidden"
                    );

                    toggle.click();
                    assert.strictEqual(
                        input.getAttribute("type"),
                        "text",
                        "the first click reveals the value"
                    );
                    assert.ok(
                        toggle.classList.contains(showHidePassword.SHOWN_ICON_CLASS),
                        "the icon switched to the crossed eye"
                    );

                    toggle.click();
                    assert.strictEqual(
                        input.getAttribute("type"),
                        "password",
                        "the second click hides the value again"
                    );
                    assert.ok(
                        toggle.classList.contains(showHidePassword.HIDDEN_ICON_CLASS),
                        "the icon switched back to the plain eye"
                    );
                }
            );

            QUnit.test("toggling never fires an input or change event", async function (
                assert
            ) {
                assert.expect(2);

                await renderPasswordInputs(1);

                var input = fixture().querySelector("input.test_password");
                var toggle = fixture().querySelector(TOGGLE_SELECTOR);
                var notified = 0;
                var count = function () {
                    notified++;
                };
                input.addEventListener("input", count);
                input.addEventListener("change", count);

                toggle.click();
                toggle.click();
                await nextTick();

                assert.strictEqual(
                    notified,
                    0,
                    "no input/change event reached the field listeners"
                );
                assert.strictEqual(
                    input.getAttribute("type"),
                    "password",
                    "the two clicks still toggled the visibility"
                );
            });

            QUnit.test("two password inputs each get their own toggle", async function (
                assert
            ) {
                assert.expect(5);

                await renderPasswordInputs(2);

                var wrappers = fixture().querySelectorAll(WRAPPER_SELECTOR);
                assert.strictEqual(wrappers.length, 2, "both inputs are wrapped");
                assert.strictEqual(
                    wrappers[0].querySelectorAll(TOGGLE_SELECTOR).length,
                    1,
                    "the first input owns a single toggle"
                );
                assert.strictEqual(
                    wrappers[1].querySelectorAll(TOGGLE_SELECTOR).length,
                    1,
                    "the second input owns a single toggle"
                );

                wrappers[0].querySelector(TOGGLE_SELECTOR).click();
                assert.strictEqual(
                    wrappers[0].querySelector("input").getAttribute("type"),
                    "text",
                    "the clicked input is revealed"
                );
                assert.strictEqual(
                    wrappers[1].querySelector("input").getAttribute("type"),
                    "password",
                    "the untouched input stays hidden"
                );
            });

            QUnit.test(
                "an unrelated mutation does not decorate an input twice",
                async function (assert) {
                    assert.expect(3);

                    await renderPasswordInputs(1);

                    var unrelated = document.createElement("div");
                    unrelated.textContent = "unrelated node";
                    fixture().appendChild(unrelated);
                    await nextTick();

                    assert.strictEqual(
                        fixture().querySelectorAll(WRAPPER_SELECTOR).length,
                        1,
                        "no second wrapper has been created"
                    );
                    assert.strictEqual(
                        fixture().querySelectorAll(TOGGLE_SELECTOR).length,
                        1,
                        "no second toggle has been created"
                    );
                    assert.strictEqual(
                        fixture().querySelectorAll("input.test_password").length,
                        1,
                        "the original input is still the only one"
                    );
                }
            );
        }
    );
});
