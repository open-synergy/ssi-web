import {Component} from "@odoo/owl";

const {DateTime} = luxon;

export class GanttRenderer extends Component {
    static template = "ssi_web_gantt.GanttRenderer";
    static props = {
        model: Object,
        archInfo: Object,
    };

    get dateStartField() {
        return this.props.archInfo.dateStartField;
    }

    get dateStopField() {
        return this.props.archInfo.dateStopField;
    }

    get dateDelayField() {
        return this.props.archInfo.dateDelayField;
    }

    /**
     * One row per group, or a single unlabelled row when the view isn't
     * grouped (no default_group_by and no active groupBy from the search
     * bar).
     */
    get rows() {
        const root = this.props.model.root;
        if (root.isGrouped) {
            return root.groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                records: group.records,
            }));
        }
        return [{id: "all", label: false, records: root.records}];
    }

    getRecordStart(record) {
        return record.data[this.dateStartField] || null;
    }

    getRecordStop(record) {
        const start = this.getRecordStart(record);
        if (!start) {
            return null;
        }
        if (this.dateStopField) {
            return record.data[this.dateStopField] || start;
        }
        const delayInHours = record.data[this.dateDelayField] || 0;
        return start.plus({hours: delayInHours});
    }

    /**
     * Earliest start / latest stop across every currently loaded record,
     * used as the shared horizontal scale for every row's bars.
     */
    get timelineBounds() {
        let min = null;
        let max = null;
        for (const row of this.rows) {
            for (const record of row.records) {
                const start = this.getRecordStart(record);
                if (!start) {
                    continue;
                }
                const stop = this.getRecordStop(record) || start;
                if (!min || start < min) {
                    min = start;
                }
                if (!max || stop > max) {
                    max = stop;
                }
            }
        }
        if (!min) {
            min = DateTime.now().startOf("day");
        }
        if (!max || max <= min) {
            max = min.plus({days: 1});
        }
        return {min, max};
    }

    getBarStyle(record) {
        const {min, max} = this.timelineBounds;
        const totalMs = max.ts - min.ts;
        const start = this.getRecordStart(record);
        if (!start || !totalMs) {
            return "left:0%;width:0%;";
        }
        const stop = this.getRecordStop(record) || start;
        const left = ((Math.max(start.ts, min.ts) - min.ts) / totalMs) * 100;
        const width = Math.max(((stop.ts - start.ts) / totalMs) * 100, 1);
        return `left:${left}%;width:${Math.min(width, 100 - left)}%;`;
    }
}
