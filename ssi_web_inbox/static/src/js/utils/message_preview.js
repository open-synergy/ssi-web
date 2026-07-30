odoo.define("ssi_web_inbox.message_preview", function () {
    "use strict";

    const DEFAULT_MAX_LENGTH = 120;

    /**
     * Decode the HTML entities left in a tag free text fragment.
     *
     * The fragment is assigned as the inner HTML of a detached textarea and
     * read back through its value. A textarea is used on purpose: its
     * content model is raw text, so no markup can be interpreted and no
     * script can be executed while decoding.
     *
     * @private
     * @param {String} text fragment that no longer contains any tag
     * @returns {String} the same fragment with its entities decoded
     */
    function _decodeEntities(text) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    }

    /**
     * Build a one line plain text preview out of a message body.
     *
     * The body of a message is HTML, which cannot be shown as is on a
     * compact row: tags have to go, entities have to become readable
     * characters and the result has to fit on a single line. Tags are
     * replaced by a space instead of being dropped, so that
     * "<p>a</p><p>b</p>" reads as "a b" rather than "ab".
     *
     * @param {String} body HTML body of a message, may be empty
     * @param {Number} [maxLength=120] maximum number of characters kept,
     *   ellipsis excluded
     * @returns {String} the preview, empty when there is nothing to show
     */
    function getMessagePreview(body, maxLength = DEFAULT_MAX_LENGTH) {
        if (!body) {
            return "";
        }
        const withoutTags = String(body).replace(/<[^>]*>/g, " ");
        const collapsed = _decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
        if (collapsed.length <= maxLength) {
            return collapsed;
        }
        return collapsed.slice(0, maxLength).trimEnd() + "…";
    }

    return {getMessagePreview};
});
