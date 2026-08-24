class AuthExchangeError extends Error {
  constructor(message = "OIDC token exchange failed") {
    super(message);
    this.name = "AuthExchangeError";
  }
}

export { AuthExchangeError as A };
//# sourceMappingURL=types2.js-D2i6RnIR.js.map
