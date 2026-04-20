// backend/server.js
// Express server that:
//   1. Loads OPENWEATHER_API_KEY from .env
//   2. Exposes GET /api/weather (see routes/weather.js)
//   3. Serves the vanilla frontend in ../frontend as static files
//      so the whole app is reachable at http://localhost:<PORT>/

const path = require("path");
const express = require("express");
const cors = require("cors");
require('dotenv').config();

// Load .env from the project root (one level above /backend), and also try /backend/.env as fallback.
require('dotenv').config();

const weatherRouter = require("./routes/weather");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Tiny request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API
app.use("/api/weather", weatherRouter);

// Serve the static frontend
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

// Fallback to index.html for the root
app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.OPENWEATHER_API_KEY) {
    console.warn(
      "⚠️  OPENWEATHER_API_KEY is not set. Create a .env file (see .env.example)."
    );
  }
});
app.get("/health", (req, res) => {
  res.send("OK");
});
