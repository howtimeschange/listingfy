export function pantsSizeChartColumn(value: unknown): string;
export function sameSizeChartTable(left: unknown, right: unknown): boolean;
export function pantsMainSizeChartColumns(titles?: unknown[], context?: unknown): string[];
export function normalizePantsMainSizeChartDraft(valueJson: unknown, options?: { fieldName?: string; context?: string }): {
  valueJson: Record<string, unknown>;
  conflicts: Array<{ size: string; values: Array<{ title: string; value: string }> }>;
  errors: string[];
};
