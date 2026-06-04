export const idPatterns = {
  requirement: /^REQ-\d{6}$/,
  event: /^evt_[A-Za-z0-9_-]+$/,
  artifact: /^art_[A-Za-z0-9_-]+$/,
  dispatchRequest: /^dispatch_req_[A-Za-z0-9_-]+$/,
  token: /^pf_(skill|dispatcher|user|bootstrap|local)_[A-Za-z0-9_-]+$/,
} as const;

export type IdKind = keyof typeof idPatterns;

export interface ParsedId {
  kind: IdKind;
  value: string;
}

export function isIdOfKind(kind: IdKind, value: string): boolean {
  return idPatterns[kind].test(value);
}

export function parseId(kind: IdKind, value: string): ParsedId {
  if (!isIdOfKind(kind, value)) {
    throw new Error(`Invalid ${kind} id: ${value}`);
  }

  return { kind, value };
}
