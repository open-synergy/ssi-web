// Copyright 2026 OpenSynergy Indonesia
// Copyright 2026 PT. Simetri Sinergi Indonesia
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

odoo.define("ssi_web_widget_ace_mode.AceEditor", function (require) {
    "use strict";

    var basic_fields = require("web.basic_fields");

    var AceEditor = basic_fields.AceEditor;

    var MODE_LIBS = [
        "/ssi_web_widget_ace_mode/static/lib/ace/mode-markdown.js",
        "/ssi_web_widget_ace_mode/static/lib/ace/mode-json.js",
    ];

    /**
     * Return a copy of the core ``jsLibs`` with this module's mode files.
     *
     * Core declares ``[ace.js, [mode-python.js, mode-xml.js]]``. The
     * result keeps that structure and appends the extra mode files to the
     * mode group, adding each path at most once.
     *
     * @param {Array} coreLibs the ``jsLibs`` currently declared.
     * @returns {Array} the extended ``jsLibs``.
     */
    function extendJsLibs(coreLibs) {
        var libs = coreLibs.map(function (lib) {
            return Array.isArray(lib) ? lib.slice() : lib;
        });
        var group = libs.filter(Array.isArray)[0];
        if (!group) {
            group = [];
            libs.push(group);
        }
        MODE_LIBS.forEach(function (path) {
            var known = libs.some(function (lib) {
                return Array.isArray(lib) ? lib.indexOf(path) >= 0 : lib === path;
            });
            if (!known) {
                group.push(path);
            }
        });
        return libs;
    }

    AceEditor.include({
        jsLibs: extendJsLibs(AceEditor.prototype.jsLibs),
    });

    return {extendJsLibs: extendJsLibs};
});
