<<<<<<< HEAD
import { getLocationFromGooglePlaces, getPlaceDetails, getHotelsNearPlace, searchPlaceWithCustomSearch, getTripadvisorReviews, getTripadvisorNearby } from "./shared.js";

export const getPlace = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "กรุณาระบุชื่อสถานที่" });
    const place = await getLocationFromGooglePlaces(query);
    if (!place) return res.status(404).json({ error: "ไม่พบสถานที่" });
    const details = await getPlaceDetails(place.placeId);
    res.json({
      ...place,
      ...details,
      photoUrl: details?.photoUrls?.[0],
      tripadvisorDetails: details?.tripadvisorDetails,
    });
  } catch (error) {
    next(error); // ส่งต่อไปยัง errorHandler
  }
};

export const getHotels = async (req, res, next) => {
  try {
    const { place } = req.query;
    if (!place) return res.status(400).json({ error: "กรุณาระบุชื่อสถานที่" });
    const placeData = await getLocationFromGooglePlaces(place);
    const [hotels, nearbyHotels] = await Promise.all([
      getHotelsNearPlace(place),
      placeData?.location ? getTripadvisorNearby(placeData.location.lat, placeData.location.lng) : [],
    ]);
    res.json({
      hotels: [
        ...hotels,
        ...nearbyHotels.filter(h => h.category === 'hotel'),
      ],
    });
  } catch (error) {
    next(error);
  }
};

export const getReviews = async (req, res, next) => {
  try {
    const { place } = req.query;
    if (!place) return res.status(400).json({ error: "กรุณาระบุชื่อสถานที่" });
    const placeData = await getLocationFromGooglePlaces(place);
    const [customReviews, tripadvisorReviews] = await Promise.all([
      searchPlaceWithCustomSearch(place, "รีวิว"),
      placeData?.tripadvisorLocationId ? getTripadvisorReviews(placeData.tripadvisorLocationId) : [],
    ]);
    res.json({ reviews: [...customReviews, ...tripadvisorReviews] });
  } catch (error) {
    next(error);
  }
};

export const getNearbyAttractions = async (req, res, next) => {
  try {
    const { place } = req.query;
    if (!place) return res.status(400).json({ error: "กรุณาระบุชื่อสถานที่" });
    const placeData = await getLocationFromGooglePlaces(place);
    if (!placeData?.location) return res.status(404).json({ error: "ไม่พบสถานที่" });
    const nearby = await getTripadvisorNearby(placeData.location.lat, placeData.location.lng);
    res.json({ attractions: nearby.filter(a => a.category === 'attraction') });
  } catch (error) {
    next(error);
  }
};
=======
import { getLocationFromGooglePlaces, getPlaceDetails, getHotelsNearPlace, searchPlaceWithCustomSearch } from "./shared.js";

export const getPlace = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });
  const place = await getLocationFromGooglePlaces(query);
  if (!place) return res.status(404).json({ error: "ไม่พบสถานที่" });
  const details = await getPlaceDetails(place.placeId);
  res.json({ ...place, ...details, photoUrl: details?.photoUrl });
};

export const getHotels = async (req, res) => {
  const { place } = req.query;
  if (!place) return res.status(400).json({ error: "Missing place" });
  const hotels = await getHotelsNearPlace(place);
  res.json({ hotels });
};

export const getReviews = async (req, res) => {
  const { place } = req.query;
  if (!place) return res.status(400).json({ error: "Missing place" });
  const reviews = await searchPlaceWithCustomSearch(place, "รีวิว");
  res.json({ reviews });
}; 
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
