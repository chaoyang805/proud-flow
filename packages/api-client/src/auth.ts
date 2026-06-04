export interface TokenProvider {
  getToken(): string | undefined;
}

export function staticTokenProvider(token: string | undefined): TokenProvider {
  return {
    getToken() {
      return token;
    },
  };
}
