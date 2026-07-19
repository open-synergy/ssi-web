import {Component, useRef} from "@odoo/owl";
import {useBus} from "@web/core/utils/hooks";
import {useModel} from "@web/model/model";
import {addFieldDependencies} from "@web/model/relational_model/utils";
import {useSetupAction} from "@web/search/action_hook";
import {Layout} from "@web/search/layout";
import {SearchBar} from "@web/search/search_bar/search_bar";
import {useSearchBarToggler} from "@web/search/search_bar/search_bar_toggler";
import {standardViewProps} from "@web/views/standard_view_props";

export class GanttController extends Component {
    static template = "ssi_web_gantt.GanttView";
    static components = {Layout, SearchBar};
    static props = {
        ...standardViewProps,
        Model: Function,
        Renderer: Function,
        buttonTemplate: String,
        archInfo: Object,
    };

    setup() {
        this.rootRef = useRef("root");
        this.model = useModel(this.props.Model, this.modelParams);
        useBus(this.model.bus, "update", () => this.render(true));
        useSetupAction({
            rootRef: this.rootRef,
            getLocalState: () => ({modelState: this.model.exportState()}),
        });
        this.searchBarToggler = useSearchBarToggler();
    }

    get modelParams() {
        const {archInfo, fields, resModel, state} = this.props;
        const {dateStartField, dateStopField, dateDelayField, defaultGroupBy} =
            archInfo;

        const fieldDependencies = [{name: dateStartField}];
        if (dateStopField) {
            fieldDependencies.push({name: dateStopField});
        }
        if (dateDelayField) {
            fieldDependencies.push({name: dateDelayField});
        }
        for (const groupBySpec of defaultGroupBy) {
            fieldDependencies.push({name: groupBySpec.split(":")[0]});
        }
        if (archInfo.hasDisplayName) {
            fieldDependencies.push({name: "display_name"});
        }
        const activeFields = {};
        addFieldDependencies(activeFields, fields, fieldDependencies);

        const modelConfig = state?.modelState?.config || {
            resModel,
            fields,
            activeFields,
            openGroupsByDefault: true,
        };

        return {
            config: modelConfig,
            state: state?.modelState,
            defaultOrderBy: [{name: dateStartField, asc: true}],
        };
    }

    get displayNoContent() {
        const root = this.model.root;
        return root.isGrouped ? !root.groups.length : !root.records.length;
    }
}
