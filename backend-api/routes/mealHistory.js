import express from "express";
import multer from "multer";
import axios from "axios";
import MealHistory from "../models/MealHistory.js";
import { createVerifyToken } from "../middleware/auth.js";
import FormData from "form-data";

// ML service URL (Hugging Face by default, override via env)
const ML_API_URL =
  process.env.ML_API_URL ||
  "https://malikgrd786-nutrition-yolo-model.hf.space/api/predict";

export default function (JWT_SECRET) {
  const router = express.Router();
  const upload = multer({ dest: "uploads/" });
  const verifyToken = createVerifyToken(JWT_SECRET);

  // POST - Upload meal image and create history entry
  router.post("/add", verifyToken, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Forward to ML backend (Hugging Face)
      const formData = new FormData();
      const fileBlob = Buffer.from(req.file.buffer);
      formData.append("image", fileBlob, req.file.originalname);

      const flaskResponse = await axios.post(ML_API_URL, formData, {
        headers: formData.getHeaders(),
      });

      // Save meal to history
      const meal = new MealHistory({
        userId: req.user.id,
        foodName: flaskResponse.data.detected[0] || "Unknown",
        calories: flaskResponse.data.nutrition[0]?.calories || 0,
        protein: flaskResponse.data.nutrition[0]?.protein || 0,
        carbohydrates: flaskResponse.data.nutrition[0]?.carbohydrates || 0,
        fat: flaskResponse.data.nutrition[0]?.fat || 0,
        mealType: req.body.mealType || "snack",
        date: new Date(),
      });

      await meal.save();

      res.json({
        success: true,
        message: "Meal added successfully",
        meal,
      });
    } catch (error) {
      console.error("❌ ML / mealHistory error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // GET - Get daily meals
  router.get("/daily/:date", verifyToken, async (req, res) => {
    try {
      const date = new Date(req.params.date);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const meals = await MealHistory.find({
        userId: req.user.id,
        date: { $gte: startOfDay, $lte: endOfDay },
      }).sort({ date: -1 });

      // Calculate totals
      const totals = meals.reduce(
        (acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbohydrates + (meal.carbohydrates || 0),
          fat: acc.fat + (meal.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      res.json({
        success: true,
        date: req.params.date,
        meals,
        totals,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET - Get monthly summary
  router.get("/monthly/:year/:month", verifyToken, async (req, res) => {
    try {
      const { year, month } = req.params;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const meals = await MealHistory.find({
        userId: req.user.id,
        date: { $gte: startDate, $lte: endDate },
      });

      // Group by day
      const dailyData = {};
      meals.forEach((meal) => {
        const day = meal.date.toISOString().split("T")[0];
        if (!dailyData[day]) {
          dailyData[day] = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            mealCount: 0,
          };
        }
        dailyData[day].calories += meal.calories;
        dailyData[day].protein += meal.protein || 0;
        dailyData[day].carbs += meal.carbohydrates || 0;
        dailyData[day].fat += meal.fat || 0;
        dailyData[day].mealCount += 1;
      });

      // Calculate monthly totals
      const monthlyTotals = Object.values(dailyData).reduce(
        (acc, day) => ({
          totalCalories: acc.totalCalories + day.calories,
          avgCalories: 0,
          totalProtein: acc.totalProtein + day.protein,
          totalCarbs: acc.totalCarbs + day.carbs,
          totalFat: acc.totalFat + day.fat,
        }),
        {
          totalCalories: 0,
          avgCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
        }
      );

      monthlyTotals.avgCalories =
        monthlyTotals.totalCalories / Object.keys(dailyData).length;

      res.json({
        success: true,
        year,
        month,
        dailyData,
        monthlyTotals,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET - Get all meals history (paginated)
  router.get("/history", verifyToken, async (req, res) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const skip = (page - 1) * limit;

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
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE - Remove a meal
  router.delete("/:mealId", verifyToken, async (req, res) => {
    try {
      const meal = await MealHistory.findOneAndDelete({
        _id: req.params.mealId,
        userId: req.user.id,
      });

      if (!meal) {
        return res.status(404).json({ error: "Meal not found" });
      }

      res.json({
        success: true,
        message: "Meal deleted successfully",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}