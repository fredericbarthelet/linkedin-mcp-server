import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Response } from "express";

export class TransportsStore {
  private _transportsBySessionId: Record<
    string,
    { transport: SSEServerTransport; auth: AuthInfo }
  > = {};

  public getTransport = (sessionId: string) =>
    this._transportsBySessionId[sessionId];

  public createTransport = (
    _endpoint: string,
    auth: AuthInfo,
    res: Response
  ) => {
    const transport = new SSEServerTransport(_endpoint, res);
    this._transportsBySessionId[transport.sessionId] = { transport, auth };

    return transport;
  };
}
