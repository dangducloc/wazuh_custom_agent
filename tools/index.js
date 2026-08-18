// file /tools/index.js this file is used to configure the AI Gateway and related settings for the application. It imports necessary modules, reads environment variables, and exports the configured AI Gateway instance for use in other parts of the application.

import { tool, jsonSchema } from "ai";

export function toAiSdkTools(toolDefinitions, toolHandlers) {
  const tools = {};
  for (const def of toolDefinitions) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: jsonSchema(def.input_schema),
      execute: async (input) => toolHandlers[def.name](input),
    });
  }
  return tools;
}