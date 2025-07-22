<<<<<<< HEAD
import { getAIResponse, getPlaceDetails, getLocationFromGooglePlaces, getTripadvisorLandmarks, getTripadvisorReviews, getTripadvisorNearby } from "./shared.js";

export const createPlan = async (req, res, next) => {
  try {
    const { startLocation, destination, days, budget, travelWith, preference, interests } = req.body;
    if (!startLocation || !destination || !budget) {
      return res.status(400).json({ error: "กรุณาระบุข้อมูลที่จำเป็น: จุดเริ่มต้น, ปลายทาง, และงบประมาณ" });
    }
    const aiPrompt = `\nช่วยวางแผนการท่องเที่ยวจาก ${startLocation} ไป ${destination} จำนวน ${days || 3} วัน งบประมาณ ${budget} บาท สไตล์: ${preference || "-"} ความสนใจ: ${interests || "-"}`;
    const place = await getLocationFromGooglePlaces(destination);
    
    const [plan, details, landmarks, reviews, nearbyAttractions] = await Promise.all([
      getAIResponse(aiPrompt),
      place?.placeId ? getPlaceDetails(place.placeId) : null,
      getTripadvisorLandmarks(destination),
      place?.tripadvisorLocationId ? getTripadvisorReviews(place.tripadvisorLocationId) : [],
      place?.location ? getTripadvisorNearby(place.location.lat, place.location.lng) : [],
    ]);

    res.json({
      plan,
      photoUrls: details?.photoUrls || [],
      placeName: details?.name || destination,
      landmarks,
      reviews,
      nearbyAttractions: nearbyAttractions.filter(a => a.category === 'attraction'),
    });
  } catch (error) {
    next(error);
  }
};
=======
import { getAIResponse, getPlaceDetails, getLocationFromGooglePlaces } from "./shared.js";

export const createPlan = async (req, res) => {
  const { startLocation, destination, days, budget, travelWith, preference, interests } = req.body;
  if (!startLocation || !destination || !budget) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const aiPrompt = `\nช่วยวางแผนการท่องเที่ยวจาก ${startLocation} ไป ${destination} จำนวน ${days || 3} วัน งบประมาณ ${budget} บาท สไตล์: ${preference || "-"} ความสนใจ: ${interests || "-"}`;
  const plan = await getAIResponse(aiPrompt);

  let photoUrls = [];
  let placeName = destination;
  try {
    const place = await getLocationFromGooglePlaces(destination);
    console.log("[DEBUG] place from GooglePlaces:", place);
    if (place && place.placeId) {
      const details = await getPlaceDetails(place.placeId);
      console.log("[DEBUG] details from getPlaceDetails:", details);
      photoUrls = details?.photoUrls || [];
      placeName = details?.name || destination;
    } else {
      console.log("[DEBUG] No placeId found for destination:", destination);
    }
  } catch (e) {
    console.error("[ERROR] fetching photoUrls:", e);
    photoUrls = [];
  }
  res.json({ plan, photoUrls, placeName });
}; 
>>>>>>> 073e983d9bfc5de307650dbfb427581aeed9eb41
