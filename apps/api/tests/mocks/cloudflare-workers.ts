export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}

interface DurableObjectState {
  id: DurableObjectId;
}

interface DurableObjectId {
  toString(): string;
}
