import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import apiRoutes from "./routes/api.js";
import chatRoutes from "./routes/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.use("/api/chat", chatRoutes);

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Marketing Dashboard running at http://localhost:${PORT}`);
  console.log(`📊  Dashboard  → http://localhost:${PORT}`);
  console.log(`🤖  Chat API   → http://localhost:${PORT}/api/chat\n`);
});
