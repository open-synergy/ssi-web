odoo.define("ssi_web_widget_ace_mode.ace_mode_tests", function (require) {
    "use strict";
    /* global QUnit*/

    var FormView = require("web.FormView");
    var testUtils = require("web.test_utils");
    var aceMode = require("ssi_web_widget_ace_mode.AceEditor");
    var AceEditor = require("web.basic_fields").AceEditor;

    var CORE_LIBS = [
        "/web/static/lib/ace/ace.js",
        "/web/static/lib/ace/mode-python.js",
        "/web/static/lib/ace/mode-xml.js",
    ];
    var MODULE_LIBS = [
        "/ssi_web_widget_ace_mode/static/lib/ace/mode-markdown.js",
        "/ssi_web_widget_ace_mode/static/lib/ace/mode-json.js",
    ];

    /**
     * Flatten a possibly nested ``jsLibs`` array.
     *
     * @param {Array} libs the ``jsLibs`` value.
     * @returns {Array} flat list of paths.
     */
    function flatten(libs) {
        return libs.reduce(function (acc, lib) {
            return acc.concat(Array.isArray(lib) ? lib : [lib]);
        }, []);
    }

    /**
     * Count occurrences of a value in an array.
     *
     * @param {Array} list the array to scan.
     * @param {String} value the value to count.
     * @returns {Number} number of occurrences.
     */
    function count(list, value) {
        return list.filter(function (item) {
            return item === value;
        }).length;
    }

    /**
     * Render a form with an Ace field and return the session mode id.
     *
     * @param {Object} data the mock data of the test.
     * @param {String} mode the ``mode`` option of the widget.
     * @returns {Promise<String>} the ``$id`` of the Ace session mode.
     */
    async function renderModeId(data, mode) {
        var form = await testUtils.createView({
            View: FormView,
            model: "partner",
            data: data,
            arch:
                '<form><field name="foo" widget="ace" options="{\'mode\': \'' +
                mode +
                "'}\"/></form>",
            res_id: 1,
        });
        await testUtils.nextTick();
        var widget = form.renderer.allFieldWidgets[form.handle][0];
        var modeId = widget.aceSession.getMode().$id;
        form.destroy();
        return modeId;
    }

    QUnit.module("ssi_web_widget_ace_mode", {
        beforeEach: function () {
            this.data = {
                partner: {
                    fields: {foo: {string: "Foo", type: "text"}},
                    records: [{id: 1, foo: '{"a": 1}'}],
                },
            };
        },
    });

    QUnit.test("jsLibs holds core and module libraries", function (assert) {
        assert.expect(5);
        var flat = flatten(AceEditor.prototype.jsLibs);
        CORE_LIBS.concat(MODULE_LIBS).forEach(function (path) {
            assert.ok(flat.indexOf(path) >= 0, path + " is declared");
        });
    });

    QUnit.test("markdown mode is applied", async function (assert) {
        assert.expect(1);
        assert.strictEqual(
            await renderModeId(this.data, "markdown"),
            "ace/mode/markdown"
        );
    });

    QUnit.test("json mode is applied", async function (assert) {
        assert.expect(1);
        assert.strictEqual(await renderModeId(this.data, "json"), "ace/mode/json");
    });

    QUnit.test("xml mode still works", async function (assert) {
        assert.expect(1);
        assert.strictEqual(await renderModeId(this.data, "xml"), "ace/mode/xml");
    });

    QUnit.test("jsLibs paths are never duplicated", function (assert) {
        assert.expect(6);
        var again = flatten(aceMode.extendJsLibs(AceEditor.prototype.jsLibs));
        CORE_LIBS.concat(MODULE_LIBS).forEach(function (path) {
            assert.strictEqual(count(again, path), 1, path + " appears once");
        });
    });
});
