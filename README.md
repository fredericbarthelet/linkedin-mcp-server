# Linkedin MCP Server

MCP server for interacting with [Linkedin Community Management API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2025-03).

This MCP server:

- Can be hosted locally or remotely : uses [HTTP+SSE transport](https://spec.modelcontextprotocol.io/specification/2024-11-05/basic/transports/#http-with-sse) defined in MCP
- Implements the [Draft Third-Party Authorization Flow from MCP specs](https://spec.modelcontextprotocol.io/specification/draft/basic/authorization/#29-third-party-authorization-flow) to delegate authorization to LinkedIn's OAuth authorization server

> ⚠️ Disclaimer: The Third-Party Authorization Flow proposal status is currently in draft. The only MCP client, to my knowledge, that currently implements this specification of the protocol is the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

## Features

### Tools

- `user-info` - Get current logged in user infos (name, headline and profile picture)
- `create-post` - Create a new post on LinkedIn

## Installation

Follow those instructions to run Linkedin MCP server on your host. You'll need to provide your own Linkedin client.

### Requirements

- Node 22 (`lts/jod`)
- pnpm 10
- a Linkedin client with `Community Management API` product installed and `http://localhost:3001/callback` added to the authorized redirect URLs

### Instructions

- Install dependencies:

```bash
pnpm install
```

- Create env file and populate with your Linkedin client credentials and a random string secret value for `JWT_SECRET`:

```bash
cp .env.template .env && vi .env
```

- Run the server:

```bash
pnpm run dev
```

- Configure your favorite MCP client to use this new server:

```json
{
  "mcpServers": {
    "linkedin": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

### Debugging

Start the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to debug this server, which is available as a package script:

```bash
pnpm run inspector
```

Access the inspector in your browser at `http://localhost:5173`

## Acknowledgment

- [Den Delimarsky](https://www.linkedin.com/in/dendeli/) that bravely gave a first shot at this new authorization flow with Microsoft Entra ID and detailed his results in his blog post: https://den.dev/blog/auth-modelcontextprotocol-entra-id/
- [Matt Pocock](https://www.linkedin.com/in/mapocock/) and his always welcome neat TS tricks specifically in the context of writting your own MCP server on AI Hero: https://www.aihero.dev/publish-your-mcp-server-to-npm
