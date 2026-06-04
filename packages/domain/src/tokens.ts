export const actorTypes = ["user", "skill", "dispatcher", "local"] as const;
export type ActorType = (typeof actorTypes)[number];

export const tokenTypes = [
  "user",
  "skill",
  "dispatcher",
  "bootstrap",
  "local",
] as const;
export type TokenType = (typeof tokenTypes)[number];

export function isActorType(value: string): value is ActorType {
  return actorTypes.includes(value as ActorType);
}

export function isTokenType(value: string): value is TokenType {
  return tokenTypes.includes(value as TokenType);
}
