// file config/model.js this file is used to configure the AI Gateway and related settings for the application. It imports necessary modules, reads environment variables, and exports the configured AI Gateway instance for use in other parts of the application.
import { createAiGateway } from "ai-gateway-provider";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env'),
});

//cloudflare
const CF_API_URL = process.env.CLOUDFLARE_API_URL || "Missing CLOUDFLARE_API_URL environment variable";
const CF_MODEL = process.env.CF_MODEL || "Missing MODEL environment variable";
const CF_AUTH_TOKEN = process.env.CLOUDFLARE_AUTH_TOKEN || "Missing CLOUDFLARE_AUTH_TOKEN environment variable";
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "Missing CLOUDFLARE_ACCOUNT_ID environment variable";

//nvidia
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "Missing NVIDIA_API_KEY environment variable";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "Missing NVIDIA_MODEL environment variable";
const NVIDIA_URL = process.env.NVIDIA_URL || "Missing NVIDIA_URL environment variable";

const nvidia = { apiKey: NVIDIA_API_KEY, model: NVIDIA_MODEL, url: NVIDIA_URL };
const cloudflare = { baseUrl: CF_API_URL, model: CF_MODEL , authToken: CF_AUTH_TOKEN, accountId: CF_ACCOUNT_ID };

export const modelConfig = { cloudflare, nvidia };
