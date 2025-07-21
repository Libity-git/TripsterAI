import express from "express";
import { getPlace, getHotels, getReviews } from "../controllers/placesController.js";
const router = express.Router();

router.get("/places", getPlace);
router.get("/hotels", getHotels);
router.get("/reviews", getReviews);

export default router; 