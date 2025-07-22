import express from "express";
import { createPlan } from "../controllers/planController.js";
const router = express.Router();

router.post("/", createPlan);
 
export default router; 