import { AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

export type Session = {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  tokenId?: string;
};

export class SessionsStore {
  private _sessions: Record<string, Session> = {};

  // Session are usually retrieved using either an OAuth state parameter or a temporary authorization code
  public getSession = (sessionId: string) => this._sessions[sessionId];

  public registerSession = (
    id: string,
    session: Session,
    expirationInSeconds?: number
  ) => {
    this._sessions[id] = session;

    if (expirationInSeconds !== undefined) {
      setTimeout(() => {
        delete this._sessions[id];
      }, expirationInSeconds * 1000);
    }
  };

  public clearSession = (sessionId: string) => {
    delete this._sessions[sessionId];
  };
}
