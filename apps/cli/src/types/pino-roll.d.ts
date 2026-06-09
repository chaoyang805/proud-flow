declare module "pino-roll" {
  import type { SonicBoom } from "sonic-boom";

  interface PinoRollOptions {
    file: string;
    size?: string | number;
    limit?: { count?: number; removeOtherLogFiles?: boolean };
    symlink?: boolean;
    mkdir?: boolean;
  }

  function pinoRoll(options: PinoRollOptions): Promise<SonicBoom>;
  export default pinoRoll;
}
