import express from "express";
import { getPlace, getHotels, getReviews, getNearbyAttractions } from "../controllers/placesController.js";
const router = express.Router();

router.get("/places", getPlace);
router.get("/hotels", getHotels);
router.get("/reviews", getReviews);
router.get("/nearby", getNearbyAttractions);

export default router;
