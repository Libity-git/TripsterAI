import express from "express";
<<<<<<< HEAD
import { getPlace, getHotels, getReviews, getNearbyAttractions } from "../controllers/placesController.js";
=======
import { getPlace, getHotels, getReviews } from "../controllers/placesController.js";
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
const router = express.Router();

router.get("/places", getPlace);
router.get("/hotels", getHotels);
router.get("/reviews", getReviews);
<<<<<<< HEAD
router.get("/nearby", getNearbyAttractions);

export default router;
=======

export default router; 
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
