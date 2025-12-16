import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ✅ ASYNC HANDLER WRAPPER
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("❌ Auth route error:", err.message);
    next(err);
  });
};

export default function (JWT_SECRET) {
  const router = express.Router();

  // ✅ POST /api/auth/signup
  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      console.log("🔄 /api/auth/signup called");

      const { name, username, password } = req.body;

      // ✅ Validate
      if (!name || !username || !password) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // ✅ Check if user exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already exists",
        });
      }

      // ✅ Create user
      const user = new User({ name, username, password });
      await user.save();

      // ✅ CREATE JWT TOKEN (NEW)
      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      // ✅ SET COOKIE (NEW)
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      console.log("✅ User created and logged in:", username);
      console.log("✅ Token created, expires in 7 days");

      res.json({
        success: true,
        message: "Signup successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
        },
      });
    })
  );
  // ✅ POST /api/auth/login
  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      console.log("🔄 /api/auth/login called");
      console.log("Body:", req.body);

      const { username, password } = req.body;

      // ✅ Validate
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password required",
        });
      }

      // ✅ Find user (WITHOUT .lean() so we can call methods)
      const user = await User.findOne({ username });

      if (!user) {
        console.error("❌ User not found:", username);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // ✅ Compare password (this is a Mongoose method)
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        console.error("❌ Invalid password for user:", username);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // ✅ Create JWT token
      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      // ✅ Set cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: true, // Set to true in production with HTTPS
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log("✅ Login successful:", username);
      console.log("✅ Token created, expires in 7 days");

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
        },
      });
    })
  );

  // ✅ POST /api/auth/logout
  router.post(
    "/logout",
    asyncHandler(async (req, res) => {
      console.log("🔄 /api/auth/logout called");

      res.clearCookie("token");

      res.json({
        success: true,
        message: "Logout successful",
      });
    })
  );

  // ✅ GET /api/auth/profile
  router.get(
    "/profile",
    asyncHandler(async (req, res) => {
      const token =
        req.cookies.token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "No token provided",
        });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            username: user.username,
          },
        });
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }
    })
  );

  return router;
}
