// @ts-check
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as DDG from "duck-duck-scrape";

// Define the web search tool schema
const WEB_SEARCH_TOOL = {
  name: "duckduckgo_web_search",
  description: "Performs a web search using DuckDuckGo, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
    "Supports content filtering and region-specific searches. " +
    "Maximum 20 results per request.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (max 400 chars)"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 10)",
        default: 10
      }
    },
    required: ["query"],
  },
};

// Server implementation
const server = new Server({
  name: "vibebot/duckduckgo-search",
  version: "0.1.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Rate limiting configuration
const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

let requestCount = {
  second: 0,
  month: 0,
  lastReset: Date.now()
};

function checkRateLimit() {
  const now = Date.now();
  if (now - requestCount.lastReset > 1000) {
    requestCount.second = 0;
    requestCount.lastReset = now;
  }

  if (requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.month >= RATE_LIMIT.perMonth) {
    throw new Error('Rate limit exceeded');
  }

  requestCount.second++;
  requestCount.month++;
}

/**
 * @typedef {Object} DuckDuckGoWebSearchArgs
 * @property {string} query - The search query
 * @property {number} [count] - Number of results (optional)
 */

/** @type {(args: unknown) => args is DuckDuckGoWebSearchArgs} */
const isDuckDuckGoWebSearchArgs = (args) => {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof args.query === "string"
  );
}

/**
 * @param {string} query - The search query
 * @param {number} [count=10] - Number of results
 * @returns {Promise<string>} The formatted search results
 */
async function performWebSearch(query, count = 10) {
  checkRateLimit();

  try {
    // Use duck-duck-scrape to perform the search
    const searchResults = await DDG.search(query, {
      safeSearch: DDG.SafeSearchType.OFF
    });

    if (!searchResults || searchResults.noResults || !searchResults.results || searchResults?.results.length === 0) {
      return `# DuckDuckGo Search Results\nNo results found for "${query}".`;
    }

    // Limit results to the requested count
    const limitedResults = searchResults.results.slice(0, Math.min(count, 20));

    // Format results in markdown
    const formattedResults = limitedResults.map(r => {
      return `### ${r.title}
${r.description || ''}

🔗 [Read more](${r.url})
`;
    }).join('\n\n');

    // Add summary before results
    return `# DuckDuckGo Search Results
${query} search results (${limitedResults.length} found)

---

${formattedResults}
`;
  } catch (error) {
    console.error('Error performing web search:', error);
    throw error;
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [WEB_SEARCH_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "duckduckgo_web_search": {
        if (!isDuckDuckGoWebSearchArgs(args)) {
          throw new Error("Invalid arguments for duckduckgo_web_search");
        }
        const { query, count = 10 } = args;
        const results = await performWebSearch(query, count);
        return {
          content: [{ type: "text", text: results }],
          isError: false,
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DuckDuckGo Search MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
