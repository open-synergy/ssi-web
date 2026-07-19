export class GanttParseArchError extends Error {}

/** Arch attributes naming a date field of the view's own model. */
const DATE_ATTRIBUTES = ["date_start", "date_stop", "date_delay"];

export class GanttArchParser {
    parse(xmlDoc, models, modelName) {
        const fields = models[modelName].fields;
        const fieldMapping = {};
        for (const attribute of DATE_ATTRIBUTES) {
            const fieldName = xmlDoc.getAttribute(attribute);
            if (fieldName) {
                fieldMapping[attribute] = fieldName;
            }
        }
        if (!fieldMapping.date_start) {
            throw new GanttParseArchError(
                `Gantt view must define a "date_start" attribute.`
            );
        }
        if (!fieldMapping.date_stop && !fieldMapping.date_delay) {
            throw new GanttParseArchError(
                `Gantt view must define a "date_stop" or a "date_delay" attribute.`
            );
        }

        const defaultGroupBy = (xmlDoc.getAttribute("default_group_by") || "")
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        return {
            dateStartField: fieldMapping.date_start,
            dateStopField: fieldMapping.date_stop || null,
            dateDelayField: fieldMapping.date_delay || null,
            defaultGroupBy,
            hasDisplayName: Boolean(fields.display_name),
        };
    }
}
