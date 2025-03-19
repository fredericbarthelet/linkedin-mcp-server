import {
  AuthorizationParams,
  OAuthServerProvider as OAuthServerProviderInterface,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthClient as LinkedinAuthClient } from "linkedin-api-client";
import { Response } from "express";
import { randomBytes } from "crypto";

import { ClientsStore } from "./ClientsStore.js";
import { SessionsStore } from "./SessionsStore.js";
import { TokensStore } from "./TokenStore.js";

export class OAuthServerProvider implements OAuthServerProviderInterface {
  private _LINKEDIN_SCOPES = ["r_basicprofile", "w_member_social"];
  private _linkedinAuthClient: LinkedinAuthClient;

  private _clientsStore: ClientsStore;
  private _sessionsStore: SessionsStore;
  private _tokensStore: TokensStore;

  constructor(clientConfiguration: {
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
  }) {
    this._linkedinAuthClient = new LinkedinAuthClient(clientConfiguration);

    this._clientsStore = new ClientsStore();
    this._sessionsStore = new SessionsStore();
    this._tokensStore = new TokensStore();
  }

  public get clientsStore() {
    return this._clientsStore;
  }

  public authorize = async (
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ) => {
    try {
      const session = { client, params };
      const state = randomBytes(32).toString("hex");
      this._sessionsStore.registerSession(state, session);
      const url = this._linkedinAuthClient.generateMemberAuthorizationUrl(
        this._LINKEDIN_SCOPES,
        state
      );

      res.redirect(url);
    } catch (error) {
      console.error("OAuthServerProvider authorize error:", error);

      res.status(500).send("Server error");
    }
  };

  public callback = async (
    authorizationCode: string,
    state: string,
    res: Response
  ) => {
    try {
      const session = this._sessionsStore.getSession(state);
      if (!session) {
        console.error(
          `OAuthServerProvider callback error: No session found for state ${state}`
        );
        res.status(400).send("Bad request");
      }

      const linkedinTokens =
        await this._linkedinAuthClient.exchangeAuthCodeForAccessToken(
          authorizationCode
        );
      const { id } = this._tokensStore.storeTokens(session, linkedinTokens);

      const code = randomBytes(32).toString("hex");
      this._sessionsStore.registerSession(
        code,
        { ...session, tokenId: id },
        5 * 60
      );
      this._sessionsStore.clearSession(state);
      const redirectUrl = new URL(session.params.redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (session.params.state) {
        redirectUrl.searchParams.set("state", session.params.state);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error("OAuthServerProvider callback error:", error);
      res.status(500).send("Server error");
    }
  };

  public challengeForAuthorizationCode = async (
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ) => {
    const session = this._sessionsStore.getSession(authorizationCode);
    if (!session) {
      throw new Error("No session found for authorization code");
    }

    return session.params.codeChallenge;
  };

  public verifyAccessToken = async (accessToken: string) => {
    const { jti, aud, exp, scopes } =
      this._tokensStore.parseAccessToken(accessToken);

    const linkedinTokens = this._tokensStore.getTokens(jti)?.linkedinTokens;

    return {
      token: accessToken,
      clientId: aud,
      scopes: scopes ?? [],
      expiresAt: exp,
      extra: { linkedinTokens },
    };
  };

  public exchangeRefreshToken = async () => {
    throw new Error("Not implemented");
  };

  public exchangeAuthorizationCode = async (
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ) => {
    const session = this._sessionsStore.getSession(authorizationCode);
    if (!session) {
      throw new Error("No session found for authorization code");
    }

    if (!session.tokenId) {
      throw new Error("Session has no token id");
    }

    const { mcpServerToken } = this._tokensStore.getTokens(session.tokenId);

    return mcpServerToken;
  };
}
