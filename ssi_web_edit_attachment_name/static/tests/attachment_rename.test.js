/* Copyright 2026 PT. Simetri Sinergi Indonesia
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {
    click,
    contains,
    defineMailModels,
    openFormView,
    start,
    startServer,
} from "@mail/../tests/mail_test_helpers";
import {describe, expect, test} from "@odoo/hoot";
import {edit} from "@odoo/hoot-dom";
import {onRpc} from "@web/../tests/web_test_helpers";

describe.current.tags("desktop");
defineMailModels();

const chatterArch = `
    <form>
        <sheet></sheet>
        <chatter open_attachments="True"/>
    </form>`;

test("rename icon is shown on a saved attachment card", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    pyEnv["ir.attachment"].create({
        mimetype: "text/plain",
        name: "Blah.txt",
        res_id: partnerId,
        res_model: "res.partner",
    });
    await start();
    await openFormView("res.partner", partnerId, {arch: chatterArch});
    await contains(".o-mail-AttachmentCard", {text: "Blah.txt"});
    await contains("button[title='Rename']");
});

test("saving a new name writes it and updates the card without reload", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    const attachmentId = pyEnv["ir.attachment"].create({
        mimetype: "text/plain",
        name: "Blah.txt",
        res_id: partnerId,
        res_model: "res.partner",
    });
    onRpc("ir.attachment", "write", ({args}) => {
        expect.step(`write:${JSON.stringify(args)}`);
    });
    await start();
    await openFormView("res.partner", partnerId, {arch: chatterArch});
    await contains(".o-mail-AttachmentCard", {text: "Blah.txt"});
    await click("button[title='Rename']");
    await contains(".modal input#ssi_attachment_rename_input");
    await click("input#ssi_attachment_rename_input");
    await edit("Renamed.txt");
    await click(".modal-footer button.btn-primary");
    expect.verifySteps([
        `write:${JSON.stringify([[attachmentId], {name: "Renamed.txt"}])}`,
    ]);
    await contains(".modal", {count: 0});
    await contains(".o-mail-AttachmentCard", {text: "Renamed.txt"});
});

test("cancel discards the edit and issues no write RPC", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    pyEnv["ir.attachment"].create({
        mimetype: "text/plain",
        name: "Blah.txt",
        res_id: partnerId,
        res_model: "res.partner",
    });
    onRpc("ir.attachment", "write", () => expect.step("write"));
    await start();
    await openFormView("res.partner", partnerId, {arch: chatterArch});
    await click("button[title='Rename']");
    await contains(".modal input#ssi_attachment_rename_input");
    await click("input#ssi_attachment_rename_input");
    await edit("Should Not Save.txt");
    await click(".modal-footer button.btn-secondary");
    expect.verifySteps([]);
    await contains(".modal", {count: 0});
    await contains(".o-mail-AttachmentCard", {text: "Blah.txt"});
});

test("saving an empty name discards the edit and issues no write RPC", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({});
    pyEnv["ir.attachment"].create({
        mimetype: "text/plain",
        name: "Blah.txt",
        res_id: partnerId,
        res_model: "res.partner",
    });
    onRpc("ir.attachment", "write", () => expect.step("write"));
    await start();
    await openFormView("res.partner", partnerId, {arch: chatterArch});
    await click("button[title='Rename']");
    await contains(".modal input#ssi_attachment_rename_input");
    await click("input#ssi_attachment_rename_input");
    await edit("");
    await click(".modal-footer button.btn-primary");
    expect.verifySteps([]);
    await contains(".modal", {count: 0});
    await contains(".o-mail-AttachmentCard", {text: "Blah.txt"});
});
