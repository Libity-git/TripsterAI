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
