import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

// ✅ LOAD ENV FIRST - BEFORE EVERYTHING
dotenv.config();

// ✅ GET JWT_SECRET - STORE IN GLOBAL
const JWT_SECRET = (process.env.JWT_SECRET || "").trim();

console.log("\n🔐 ===== JWT_SECRET DEBUG =====");
console.log("Raw value:", JSON.stringify(process.env.JWT_SECRET));
console.log("After trim:", JSON.stringify(JWT_SECRET));
console.log("Length:", JWT_SECRET.length);
console.log("First 20 chars:", JWT_SECRET.substring(0, 20));
console.log("================================\n");

if (!JWT_SECRET || JWT_SECRET.length === 0) {
  console.error("❌ ERROR: JWT_SECRET not found or empty in .env file!");
  process.exit(1);
}

console.log("✅ JWT_SECRET loaded and ready to use");

// ✅ NOW import routes AFTER env is loaded
import authRoutes from "./routes/auth.js";
import mealsRoutes from "./routes/meals.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MIDDLEWARE - CORS with all necessary origins
app.use(
  cors({
    origin: [
      "http://localhost:3000", // ✅ Added for local React
      "http://localhost:5173", // ✅ Vite local
      "https://nutri-tracker-frontend.onrender.com", // ✅ Production
    ],
    credentials: true, // ✅ Allow cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Debug middleware
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  console.log("🍪 Cookies:", req.cookies);
  console.log(
    "🔐 Auth header:",
    req.headers.authorization ? "✅ Present" : "❌ Missing"
  );
  next();
});

// ✅ PASS JWT_SECRET to routes as parameter
app.use("/api/auth", authRoutes(JWT_SECRET));
app.use("/api/meals", mealsRoutes(JWT_SECRET));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "✅ Backend running",
    database:
      mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ✅ GLOBAL ERROR HANDLER - MUST BE LAST
app.use((err, req, res, next) => {
  console.error("\n🚨 ===== GLOBAL ERROR HANDLER =====");
  console.error("Error type:", err.constructor.name);
  console.error("Error message:", err.message);
  console.error("Error stack:", err.stack);
  console.error("Request path:", req.path);
  console.error("Request method:", req.method);
  console.error("===================================\n");

  // Send error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});

let server = null;

// ✅ START SERVER ONLY AFTER DB CONNECTS
const startServer = () => {
  server = app.listen(PORT, () => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ Server LISTENING on http://localhost:${PORT}`);
    console.log(`📝 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`🍽️ Meals API: http://localhost:${PORT}/api/meals`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`${"=".repeat(60)}\n`);
  });
};

// ✅ CONNECT TO MONGODB
const connectDB = async () => {
  let retries = 0;
  const MAX_RETRIES = 5;

  while (retries < MAX_RETRIES) {
    try {
      console.log(
        `🔄 Connecting to MongoDB (Attempt ${retries + 1}/${MAX_RETRIES})...`
      );

      if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI not found in .env");
      }

      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 5,
        retryWrites: true,
        w: "majority",
      });

      console.log("✅ MongoDB connected!");

      // ✅ Add error handlers to prevent silent disconnections
      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err.message);
      });
      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected - attempting to reconnect...");
      });

      // ✅ START SERVER AFTER DB CONNECTION SUCCESS
      startServer();
      return;
    } catch (err) {
      retries++;
      console.error(`❌ Connection attempt ${retries} failed:`, err.message);

      if (retries < MAX_RETRIES) {
        console.log(`⏳ Retrying in 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error("❌ Failed to connect to MongoDB after all retries");
        process.exit(1);
      }
    }
  }
};

connectDB();

// ✅ CRASH HANDLERS - Prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("\n🚨 ===== UNCAUGHT EXCEPTION =====");
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
  console.error("===============================\n");
  // Give time for logs to write
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n⚠️ ===== UNHANDLED REJECTION =====");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  console.error("===============================\n");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n⏹️ Shutting down...");
  if (server) {
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log("✅ Closed");
        process.exit(0);
      });
    });
  }
});

export { JWT_SECRET };
