import {registry} from "@web/core/registry";
import {RelationalModel} from "@web/model/relational_model/relational_model";
import {GanttArchParser} from "./gantt_arch_parser.esm";
import {GanttController} from "./gantt_controller.esm";
import {GanttRenderer} from "./gantt_renderer.esm";

export const ganttView = {
    type: "ssi_gantt",

    ArchParser: GanttArchParser,
    Controller: GanttController,
    Model: RelationalModel,
    Renderer: GanttRenderer,

    buttonTemplate: "ssi_web_gantt.GanttView.Buttons",
    searchMenuTypes: ["filter", "groupBy", "favorite"],

    props: (genericProps, view) => {
        const {ArchParser} = view;
        const {arch, relatedModels, resModel} = genericProps;
        return {
            ...genericProps,
            archInfo: new ArchParser().parse(arch, relatedModels, resModel),
            Model: view.Model,
            Renderer: view.Renderer,
            buttonTemplate: view.buttonTemplate,
        };
    },
};

registry.category("views").add("ssi_gantt", ganttView);
