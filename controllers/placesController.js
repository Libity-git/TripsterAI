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