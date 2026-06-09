export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CliIo {
  writeOut: (text: string) => void;
  writeErr: (text: string) => void;
}
