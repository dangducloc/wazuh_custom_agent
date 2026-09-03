import express from "express";
import { randomUUID } from "crypto";
import { chat } from "./chat.js";
import { agentMemory } from "../memory/agent-memory.js";

const api = express();
api.use(express.json());

api.get("/", (req, res) => {
    res.json({ message: "Sup:>" });
});

api.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Create a new session (optional - you can pass any sessionId you like to /chat)
api.post("/session/new", (req, res) => {
    const sessionId = randomUUID();
    agentMemory.getHistory(sessionId); // initialize empty history + persist
    res.json({ sessionId });
});

api.get("/session/list", (req, res) => {
    res.json({ sessions: agentMemory.listSessions() });
});

api.delete("/session/:id", (req, res) => {
    agentMemory.deleteSession(req.params.id);
    res.json({ deleted: req.params.id });
});

api.post("/chat", (req, res) => {
    let message = req.body?.message;
    if (!message) {
        return res.status(400).json({ error: "Message is required for chat." });
    }
    if (typeof message !== "string") {
        return res.status(400).json({ error: "Message must be a string." });
    }
    if (message.length <= 0) {
        return res.status(400).json({ error: "Message cannot be empty." });
    }

    const sessionId = req.body?.sessionId || "default";

    chat(message, sessionId)
        .then((reply) => res.json({ reply, sessionId }))
        .catch((err) => res.status(500).json({ error: err.message }));
});

export { api };
