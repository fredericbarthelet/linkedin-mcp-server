import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import express from "express";
import { z } from "zod";

import { Tools } from "./mcp/Tools.js";
import { OAuthServerProvider } from "./auth/OAuthServerProvider.js";
import { TransportsStore } from "./mcp/TransportsStore.js";

// Create an MCP server
const server = new McpServer(
  {
    name: "Linkedin",
    version: "0.1.0",
  },
  { capabilities: { tools: { listChanged: true } } }
);

const provider = new OAuthServerProvider({
  clientId: process.env.LINKEDIN_CLIENT_ID as string,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET as string,
  redirectUrl: "http://localhost:3001/callback",
});

const transportsStore = new TransportsStore();

const app = express();
app.use(
  mcpAuthRouter({
    issuerUrl: new URL("http://localhost:3001"),
    provider,
  })
);

const tools = new Tools();

server.tool(
  "user-info",
  "Get information about currently logged in LinkedIn user",
  async ({ sessionId }) => {
    if (!sessionId) {
      throw new Error("No sessionId found");
    }

    const { auth } = transportsStore.getTransport(sessionId);
    const { linkedinTokens } = (
      auth as unknown as { extra: { linkedinTokens: OAuthTokens } }
    ).extra;

    return tools.userInfo(linkedinTokens);
  }
);

server.tool(
  "create-post",
  "Create a new post on LinkedIn",
  { content: z.string() },
  async ({ content }, { sessionId }) => {
    if (!sessionId) {
      throw new Error("No sessionId found");
    }

    const { auth } = transportsStore.getTransport(sessionId);
    const { linkedinTokens } = (
      auth as unknown as { extra: { linkedinTokens: OAuthTokens } }
    ).extra;

    return tools.createPost({ content }, linkedinTokens);
  }
);

app.get("/callback", async ({ query: { code, state } }, res) => {
  if (
    !code ||
    !state ||
    typeof code !== "string" ||
    typeof state !== "string"
  ) {
    res.status(400).send("Invalid request parameters");
    return;
  }

  await provider.callback(code, state, res);
});

app.get(
  "/sse",
  requireBearerAuth({ provider, requiredScopes: [] }),
  async (req, res) => {
    const transport = transportsStore.createTransport(
      "/messages",
      req.auth as AuthInfo,
      res
    );
    await server.connect(transport);
  }
);

app.post(
  "/messages",
  requireBearerAuth({ provider, requiredScopes: [] }),
  async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const { transport } = transportsStore.getTransport(sessionId);
    if (!transport) {
      res.status(400).send("No transport found");
      return;
    }

    await transport.handlePostMessage(req, res);
  }
);

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
