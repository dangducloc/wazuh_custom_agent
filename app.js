// app.js
import "dotenv/config";
import { CloudflareAI } from "./model/cloudflare-ai.js";
import { logger } from "./utils/index.js";
import { wazuhToolDefinitions, wazuhToolHandlers } from "./tools/descriptions.js";
import {modelConfig} from "./config/index.js"


const MODEL = modelConfig.MODEL ;

const client = new CloudflareAI({
  accountId: modelConfig.CLOUDFLARE_ACCOUNT_ID,
  authToken: modelConfig.CLOUDFLARE_AUTH_TOKEN,
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
        content: "check if cluster is healthy and if not, provide the reason",
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
