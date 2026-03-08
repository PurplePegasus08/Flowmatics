/**
 * Parses natural language filter commands like:
 * - "Show only sales > 1000"
 * - "Filter for California"
 * - "age < 30"
 * into structured filter objects
 */

export interface ParsedFilter {
    column: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: string | number;
}

export function parseNLFilter(query: string): ParsedFilter | null {
    const q = query.trim().toLowerCase();

    // Remove common prefixes
    const cleaned = q
        .replace(/^show only\s+/i, '')
        .replace(/^filter for\s+/i, '')
        .replace(/^filter\s+/i, '');

    // Pattern: column operator value (e.g., "sales > 1000")
    const opMatch = cleaned.match(/^(\w+)\s*(>=|<=|>|<|!=|==|=)\s*(.+)$/);
    if (opMatch) {
        const [, column, op, value] = opMatch;
        const numValue = Number(value);
        return {
            column: column.trim(),
            operator: op === '=' ? '==' : (op as any),
            value: isNaN(numValue) ? value.trim() : numValue
        };
    }

    // Pattern: "column_name value" (implicit equality, e.g., "state California")
    const implicitMatch = cleaned.match(/^(\w+)\s+(.+)$/);
    if (implicitMatch) {
        const [, column, value] = implicitMatch;
        const numValue = Number(value);
        return {
            column: column.trim(),
            operator: '==',
            value: isNaN(numValue) ? value.trim() : numValue
        };
    }

    return null;
}

export function applyNLFilter(data: any[], filter: ParsedFilter): any[] {
    if (!filter) return data;

    return data.filter(row => {
        const cellValue = row[filter.column];
        if (cellValue === undefined || cellValue === null) return false;

        const val = typeof cellValue === 'number' ? cellValue : String(cellValue).toLowerCase();
        const filterVal = typeof filter.value === 'number' ? filter.value : String(filter.value).toLowerCase();

        switch (filter.operator) {
            case '>':
                return typeof val === 'number' && typeof filterVal === 'number' && val > filterVal;
            case '<':
                return typeof val === 'number' && typeof filterVal === 'number' && val < filterVal;
            case '>=':
                return typeof val === 'number' && typeof filterVal === 'number' && val >= filterVal;
            case '<=':
                return typeof val === 'number' && typeof filterVal === 'number' && val <= filterVal;
            case '==':
                return val == filterVal;
            case '!=':
                return val != filterVal;
            default:
                return true;
        }
    });
}
