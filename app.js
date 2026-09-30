//
import dotenv from "dotenv";
dotenv.config();
import { api } from "./api/api.js";
import { agentMemory } from "./memory/index.js";

api.listen(process.env.PROXY_PORT || 3000, () => {
    console.log(
        `Proxy server is running on port ${process.env.PROXY_PORT || 3000}`,
    );
});

async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    try {
        await agentMemory.flush();
        agentMemory.close();
    } catch (err) {
        console.error("Error during shutdown:", err.message);
    }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
