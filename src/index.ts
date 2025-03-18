import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios, { isAxiosError } from "axios";
import { z } from "zod";
import { RestliClient as LinkedinClient } from "linkedin-api-client";
import express from "express";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { OAuthServerProvider } from "./auth/OAuthServerProvider.js";

const linkedinClient = new LinkedinClient();

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

const app = express();
app.use(
  mcpAuthRouter({
    issuerUrl: new URL("http://localhost:3001"),
    provider,
  })
);

// Add user-info tool
server.tool(
  "user-info",
  "Get information about currently logged in LinkedIn user",
  async () => {
    try {
      const { data } = await linkedinClient.get({
        resourcePath: "/me",
        queryParams: {
          projection: `(${[
            "localizedFirstName",
            "localizedLastName",
            "localizedHeadline",
            "profilePicture(displayImage~digitalmediaAsset:playableStreams)",
          ].join(",")})`,
        },
        accessToken: "token.access_token",
      });
      const {
        localizedHeadline,
        localizedFirstName,
        localizedLastName,
        profilePicture,
      } = await z
        .object({
          localizedHeadline: z.string(),
          localizedFirstName: z.string(),
          localizedLastName: z.string(),
          profilePicture: z
            .object({
              "displayImage~": z.object({
                elements: z.array(
                  z.object({
                    identifiers: z.tuple([
                      z.object({
                        identifier: z.string().url(),
                      }),
                    ]),
                  })
                ),
              }),
            })
            .transform(async (profilePicture) => {
              const profilePicureUrl = profilePicture["displayImage~"].elements
                .pop()
                ?.identifiers.pop()?.identifier;
              if (!profilePicureUrl) {
                return undefined;
              }

              const { data, headers } = await axios.get(profilePicureUrl, {
                responseType: "arraybuffer",
              });
              const mimeType = headers["content-type"];
              const base64Data = Buffer.from(data, "binary").toString("base64");
              return { mimeType, data: base64Data };
            }),
        })
        .parseAsync(data);

      const content: CallToolResult["content"] = [
        {
          type: "text",
          text: `Currently logged in user is ${[
            localizedFirstName,
            localizedLastName,
          ].join(" ")} - ${localizedHeadline}`,
        },
      ];

      if (profilePicture) {
        content.push({
          type: "image",
          ...profilePicture,
        });
      }

      return { content };
    } catch (e) {
      if (isAxiosError(e)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `[${e.response?.status} ${e.response?.statusText}] Linkedin API error: ${e.response?.data?.message}`,
            },
          ],
        };
      }

      if (e instanceof z.ZodError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unexpected Linkedin API response format: ${JSON.stringify(
                e.issues
              )}`,
            },
          ],
        };
      }

      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(e) }],
      };
    }
  }
);

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
    await transport.handlePostMessage(req, res);
  }
);

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
