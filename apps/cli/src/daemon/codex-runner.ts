export interface CodexRunner {
  run(command: string): Promise<void>;
}

export interface MockCodexRunner extends CodexRunner {
  calls: Array<{ command: string }>;
}

export function createMockCodexRunner(
  options: { failWith?: string } = {},
): MockCodexRunner {
  return {
    calls: [],
    async run(command) {
      this.calls.push({ command });
      if (options.failWith) throw new Error(options.failWith);
    },
  };
}

export function createCodexCliRunner(options: {
  execute(command: string, args: readonly string[]): Promise<void>;
}): CodexRunner {
  return {
    async run(command) {
      await options.execute("codex", ["exec", command]);
    },
  };
}
