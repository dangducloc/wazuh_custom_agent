// app.js
import "dotenv/config";
import { CloudflareAI } from "./model/cloudflare-ai.js";
import { logger } from "./utils/index.js";
import { wazuhToolDefinitions, wazuhToolHandlers } from "./tools/descriptions.js";
import {modelConfig} from "./config/index.js"


const MODEL = modelConfig.cloudflare.model ;

const client = new CloudflareAI({
  accountId: modelConfig.cloudflare.accountId,
  authToken: modelConfig.cloudflare.authToken,
});

client.registerTools(wazuhToolHandlers);

logger.info("Starting the application...");
logger.info(`Using model: ${MODEL}`);

try {
  const reply = await client.chat({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an AI threat hunting agent for Wazuh. Always check the mapping/index before searching if you are not sure about field names.",
      },
      {
        role: "user",
        content: "try to create a new rule to ping test ",
      },
    ],
    toolDefinitions: wazuhToolDefinitions,
    maxTokens: 4096,
    trace: true,
  });

  console.log(reply);
  logger.info("Text generation completed successfully.");
} catch (err) {
  logger.error({ err: err.message }, "Error during text generation.");
}
