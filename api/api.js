import express from "express";
import { chat } from "./chat.js";

const api = express();
api.use(express.json());

api.get("/", (req, res) => {
    res.json({ message: "Sup:>" });
});

api.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

api.post("/chat", (req, res) => {
    if (!message) {
        return res.status(400).json({ error: "Message is required for chat." });
    }
    const message = req.body?.message;
    if (typeof message !== "string") {
        return res.status(400).json({ error: "Message must be a string." });
    }
    if (message.length <= 0) {
        return res.status(400).json({ error: "Message cannot be empty." });
    }

    chat(message)
        .then((reply) => res.json({ reply }))
        .catch((err) => res.status(500).json({ error: err.message }));
});

export { api };
