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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(errorHandler);

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

// --- ใช้ routes ที่แยกไว้ ---
app.use("/api/plan", planRoutes);
app.use("/api", placesRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌐 Tripster Web API running on port ${PORT}`);
}); 