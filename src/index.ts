import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios, { isAxiosError } from "axios";
import { z } from "zod";
import { RestliClient as LinkedinClient } from "linkedin-api-client";

const linkedinClient = new LinkedinClient();
const linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN as string;

// Create an MCP server
const server = new McpServer(
  {
    name: "Linkedin",
    version: "0.1.0",
  },
  { capabilities: { tools: { listChanged: true } } }
);

// Add an addition tool
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
        accessToken: linkedinAccessToken,
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

// Start receiving messages on stdin and sending messages on stdout
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Linkedin MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
