import express from "express";
import { createPlan } from "../controllers/planController.js";
const router = express.Router();

router.post("/", createPlan);
<<<<<<< HEAD
 
=======

>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
export default router; 