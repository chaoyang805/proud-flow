import { Option } from "commander";

export function formatAllowedValues(choices: readonly string[]): string {
  return choices.join(", ");
}

export function enumOption(
  flags: string,
  label: string,
  choices: readonly string[],
  options?: { mandatory?: boolean; defaultValue?: string },
): Option {
  const description = `${label} (allowed: ${formatAllowedValues(choices)})`;
  const option = new Option(flags, description).choices([...choices]);
  if (options?.defaultValue !== undefined) {
    option.default(options.defaultValue);
  }
  if (options?.mandatory) {
    option.makeOptionMandatory();
  }
  return option;
}
