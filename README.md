# duck-duck-scrape-mcp
An MCP server for (free!) search results via duckduckgo

This is like the Brave search mcp server, but it's just scraping duckduckgo. Consult duckduckgo's [tos](https://duckduckgo.com/tos) before using.

## How to use

It's not currently published to npm, so use the `github:` directive:

.mcp.json:

```json
{
  "mcpServers": {
    "duckduckgo-web-search": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "github:mmkal/duck-duck-scrape-mcp"
      ]
    }
  }
}
```
