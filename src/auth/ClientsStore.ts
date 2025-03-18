import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

export class ClientsStore implements OAuthRegisteredClientsStore {
  private _clientsByClientId: Record<string, OAuthClientInformationFull> = {};

  public getClient = (clientId: string) => this._clientsByClientId[clientId];

  public registerClient = (client: OAuthClientInformationFull) => {
    this._clientsByClientId[client.client_id] = client;

    return client;
  };
}
