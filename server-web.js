import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import planRoutes from "./routes/planRoutes.js";
import placesRoutes from "./routes/placesRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
<<<<<<< HEAD
import rateLimit from "express-rate-limit";
=======
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
<<<<<<< HEAD

// ตั้งค่า rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // จำกัด 100 requests ต่อ IP
  message: "คุณเรียก API มากเกินไป กรุณาลองใหม่ในภายหลัง",
});
app.use("/api", limiter);
=======
app.use(errorHandler);
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41

const requiredEnvVars = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_VISION_API_KEY",
  "PROJECT_ID",
  "GOOGLE_CUSTOM_SEARCH_API_KEY",
  "GOOGLE_CUSTOM_SEARCH_ENGINE_ID",
<<<<<<< HEAD
  "TRIPADVISOR_API_KEY", // เพิ่ม Tripadvisor API key
=======
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    process.exit(1);
  }
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
console.log("✅ Firebase initialized successfully (Web API)");

<<<<<<< HEAD
app.use("/api/plan", planRoutes);
app.use("/api", placesRoutes);
app.use(errorHandler);
=======
// --- ใช้ routes ที่แยกไว้ ---
app.use("/api/plan", planRoutes);
app.use("/api", placesRoutes);
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌐 Tripster Web API running on port ${PORT}`);
<<<<<<< HEAD
});
=======
}); 
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
