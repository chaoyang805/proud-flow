function formatDisplayValue(value: unknown): string {
  if (value === undefined) return "(missing)";
  return JSON.stringify(value);
}

export class SchemaValidationError extends Error {
  readonly field: string;
  readonly value: unknown;
  readonly allowedValues?: readonly string[];

  constructor(
    message: string,
    options: {
      field?: string;
      value?: unknown;
      allowedValues?: readonly string[];
    } = {},
  ) {
    super(message);
    this.name = "SchemaValidationError";
    this.field = options.field ?? "";
    this.value = options.value;
    this.allowedValues = options.allowedValues;
  }

  formatMessage(): string {
    const parts: string[] = [];
    if (this.field) {
      parts.push(`field "${this.field}"`);
    }
    parts.push(`got ${formatDisplayValue(this.value)}`);
    if (this.allowedValues?.length) {
      parts.push(`allowed: ${this.allowedValues.join(", ")}`);
    }
    return parts.join("; ");
  }
}
