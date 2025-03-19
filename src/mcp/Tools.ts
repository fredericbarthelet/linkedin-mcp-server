import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { RestliClient as LinkedinClient } from "linkedin-api-client";
import axios, { isAxiosError } from "axios";
import { z } from "zod";
import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export class Tools {
  private _linkedinClient: LinkedinClient;
  constructor() {
    this._linkedinClient = new LinkedinClient();
  }

  public userInfo = async (
    linkedinTokens: OAuthTokens
  ): Promise<CallToolResult> => {
    try {
      const { data } = await this._linkedinClient.get({
        resourcePath: "/me",
        queryParams: {
          projection: `(${[
            "localizedFirstName",
            "localizedLastName",
            "localizedHeadline",
            "profilePicture(displayImage~digitalmediaAsset:playableStreams)",
          ].join(",")})`,
        },
        accessToken: linkedinTokens.access_token,
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
  };

  public createPost = async (
    post: { content: string },
    linkedinTokens: OAuthTokens
  ): Promise<CallToolResult> => {
    try {
      const { data } = await this._linkedinClient.get({
        resourcePath: "/me",
        queryParams: {
          projection: "(id)",
        },
        accessToken: linkedinTokens.access_token,
      });
      const { id: personId } = await z
        .object({
          id: z.string(),
        })
        .parse(data);

      await this._linkedinClient.create({
        resourcePath: "/posts",
        entity: {
          author: `urn:li:person:${personId}`,
          commentary: post.content,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        },
        accessToken: linkedinTokens.access_token,
      });

      return {
        content: [
          {
            type: "text",
            text: "Your post has been successfully created!",
          },
        ],
      };
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
  };
}
