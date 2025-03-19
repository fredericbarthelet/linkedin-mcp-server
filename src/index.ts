import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express from "express";
import getRawBody from "raw-body";

import { OAuthServerProvider } from "./auth/OAuthServerProvider.js";
import { Tools } from "./mcp/Tools.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

// Create an MCP server
const server = new Server(
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

const app = express();
app.use(
  mcpAuthRouter({
    issuerUrl: new URL("http://localhost:3001"),
    provider,
  })
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Tools.TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tools = new Tools();
  const { name, extra } = request.params;
  const { linkedinTokens } = extra as { linkedinTokens?: OAuthTokens };

  if (!linkedinTokens) {
    throw new Error("No linkedin tokens found");
  }

  switch (name) {
    case "user-info":
      return tools.userInfo(linkedinTokens);
    case "create-post":
      return tools.createPost(
        request.params.arguments as { content: string },
        linkedinTokens
      );
    default:
      throw new Error(`Tool ${name} not found`);
  }
});

let transport: SSEServerTransport;

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
  async (_req, res) => {
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  }
);

app.post(
  "/messages",
  requireBearerAuth({ provider, requiredScopes: [] }),
  async (req, res) => {
    if (!transport) {
      res.status(400).send("No transport found");
      return;
    }
    const rawBody = await getRawBody(req, {
      limit: "1mb",
      encoding: "utf-8",
    });

    const messageBody = JSON.parse(rawBody.toString());
    if (!messageBody.params) {
      messageBody.params = {};
    }
    messageBody.params.extra = (
      req.auth as unknown as { extra: { linkedinTokens?: OAuthTokens } }
    )?.extra;

    await transport.handlePostMessage(req, res, messageBody);
  }
);

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
