// file config/model.js this file is used to configure the AI Gateway and related settings for the application. It imports necessary modules, reads environment variables, and exports the configured AI Gateway instance for use in other parts of the application.
import { createAiGateway } from "ai-gateway-provider";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env'),
});

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "Missing CLOUDFLARE_ACCOUNT_ID environment variable";
const CLOUDFLARE_AUTH_TOKEN = process.env.CLOUDFLARE_AUTH_TOKEN || "Missing CLOUDFLARE_AUTH_TOKEN environment";
const GATEWAY = process.env.GATEWAY || "Missing GATEWAY environment variable";

// console.log("CLOUDFLARE_ACCOUNT_ID:", CLOUDFLARE_ACCOUNT_ID);
// console.log("CLOUDFLARE_AUTH_TOKEN:", CLOUDFLARE_AUTH_TOKEN);
// console.log("GATEWAY:", GATEWAY);

const MODEL = process.env.MODEL || "Missing MODEL environment variable";
const aigateway = createAiGateway({
  accountId: CLOUDFLARE_ACCOUNT_ID,
  gateway: GATEWAY,
  apiKey: CLOUDFLARE_AUTH_TOKEN,
  baseUrl: `https://gateway.ai.cloudflare.com/v1/${CLOUDFLARE_ACCOUNT_ID}/${GATEWAY}/compat/chat/completions`,
});

export const modelConfig = { MODEL, aigateway, CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_AUTH_TOKEN };
