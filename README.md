# Linkedin MCP Server

MCP server for interacting with Linkedin Community Management API

This is a TypeScript-based MCP server that allows posting on the platform on behalf of a user or an organization.

## Features

### Tools

- `user-info` - Get current logged in user infos (name, headline and profile picture)

## Development

Install dependencies:

```bash
pnpm install
```

Build the server:

```bash
pnpm run build
```

For development with auto-rebuild:

```bash
pnpm run watch
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
pnpm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
