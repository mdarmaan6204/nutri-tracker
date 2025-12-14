import express from "express";
import multer from "multer";
import MealHistory from "../models/MealHistory.js";
import { createVerifyToken } from "../middleware/auth.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

// ✅ ML service URL (Hugging Face by default, override via env)
const ML_API_URL =
  process.env.ML_API_URL ||
  "https://malikgrd786-nutrition-yolo-model.hf.space/api/predict";

// ✅ ASYNC HANDLER WRAPPER
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("❌ Route error:", err.message);
    next(err);
  });
};

export default function (JWT_SECRET) {
  const router = express.Router();
  const verifyToken = createVerifyToken(JWT_SECRET);

  // ✅ Configure multer for image uploads
  const uploadsDir = "uploads";
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("📁 Created uploads directory");
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });

  // ✅ POST /api/meals/add - UPLOAD IMAGE AND DETECT FOOD
  router.post("/add", upload.single("image"), asyncHandler(async (req, res) => {
    console.log("\n📝 ===== POST /api/meals/add =====");
    console.log("📁 File info:", req.file ? {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    } : "NO FILE");

    if (!req.file) {
      console.error("❌ No image file provided");
      return res.status(400).json({
        success: false,
        message: "No image provided",
      });
    }

    console.log("✅ Image received:", req.file.filename);
    console.log("🔄 Sending to ML service:", ML_API_URL);

    try {
      // ✅ SEND IMAGE TO FLASK ML MODEL
      const formData = new FormData();
      const fileStream = fs.createReadStream(req.file.path);
      formData.append("image", fileStream, req.file.originalname);

      const flaskResponse = await axios.post(ML_API_URL, formData, {
        headers: formData.getHeaders(),
        timeout: 30000,
      });

      console.log("✅ Flask response received:", flaskResponse.data);

      // ✅ Clean up temporary file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log("🧹 Cleaned up temporary file");
      }

      // ✅ Return Flask response to frontend
      res.json({
        success: true,
        message: "Image analyzed successfully",
        prediction: flaskResponse.data,
      });
    } catch (flaskError) {
      console.error("❌ ML service error:");
      console.error("   URL:", ML_API_URL);
      console.error("   Status:", flaskError.response?.status);
      console.error("   Message:", flaskError.message);

      // ✅ Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        message: "ML model unavailable. Check ML_API_URL and Hugging Face Space status.",
        error: flaskError.message,
      });
    }
  }));

  // ✅ POST /api/meals/save - SAVE MEAL DATA
  router.post("/save", verifyToken, asyncHandler(async (req, res) => {
    const { foodName, detected, nutrition, mealType, date } = req.body;

    // ✅ Validate required fields
    if (!foodName || !nutrition || !Array.isArray(nutrition)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: foodName, nutrition (must be array)",
      });
    }

    // ✅ Calculate totals
    const totals = nutrition.reduce(
      (acc, n) => {
        acc.calories += n.calories || 0;
        acc.protein += n.protein || 0;
        acc.carbohydrates += n.carbohydrates || 0;
        acc.fat += n.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    );

    // ✅ Create meal document
    const mealDoc = new MealHistory({
      userId: req.user.id,
      foodName,
      detected: detected || [],
      mealType: mealType || "snack",
      calories: totals.calories,
      protein: totals.protein,
      carbohydrates: totals.carbohydrates,
      fat: totals.fat,
      date: date ? new Date(date) : new Date(),
    });

    // ✅ Save to database
    await mealDoc.save();

    console.log("✅ Meal saved:", foodName);

    res.json({
      success: true,
      message: "Meal saved successfully",
      meal: mealDoc,
    });
  }));

  // ✅ GET /api/meals/history - GET PAGINATED MEALS
  router.get("/history", verifyToken, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`📄 Fetching meals - Page ${page}, Limit ${limit}`);

    const meals = await MealHistory.find({ userId: req.user.id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MealHistory.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      meals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  }));

  // ✅ GET /api/meals/all - GET ALL MEALS FOR ANALYTICS
  router.get("/all", verifyToken, asyncHandler(async (req, res) => {
    console.log("📊 Fetching all meals for analytics");

    const meals = await MealHistory.find({ userId: req.user.id }).sort({
      date: -1,
    });

    res.json({
      success: true,
      meals,
    });
  }));

  // ✅ DELETE /api/meals/:id - DELETE MEAL
  router.delete("/:id", verifyToken, asyncHandler(async (req, res) => {
    console.log("🗑️ Deleting meal:", req.params.id);

    const meal = await MealHistory.findByIdAndDelete(req.params.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found",
      });
    }

    res.json({
      success: true,
      message: "Meal deleted successfully",
    });
  }));

  return router;
}