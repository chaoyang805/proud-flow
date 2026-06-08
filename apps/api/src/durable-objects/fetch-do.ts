export interface DoStub {
  fetch(input: unknown, init?: unknown): Promise<Response>;
}

export function fetchDo(stub: DoStub, request: Request): Promise<Response> {
  return stub.fetch(request);
}
