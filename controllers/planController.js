import {
  getAIResponse,
  getPlaceDetails,
  getLocationFromGooglePlaces,
  getTripadvisorLandmarks,
  getTripadvisorReviews,
  getTripadvisorNearby
} from "./shared.js";

const safeCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (e) {
    console.error(e.message);
    return fallback;
  }
};

export const createPlan = async (req, res, next) => {
  try {
    const { startLocation, destination, days = 3, budget, travelWith, preference = "-", interests = "-" } = req.body;

    if (!startLocation || !destination || !budget) {
      return res.status(400).json({
        error: "กรุณาระบุข้อมูลที่จำเป็น: จุดเริ่มต้น, ปลายทาง, และงบประมาณ",
      });
    }

    const aiPrompt = `\nช่วยวางแผนการท่องเที่ยวจาก ${startLocation} ไป ${destination} จำนวน ${days} วัน งบประมาณ ${budget} บาท สไตล์: ${preference} ความสนใจ: ${interests}`;
    
    const place = await safeCall(() => getLocationFromGooglePlaces(destination));

    const [plan, details, landmarks, reviews, nearby] = await Promise.all([
      safeCall(() => getAIResponse(aiPrompt), "ขออภัย ฉันไม่สามารถให้แผนได้ กรุณาลองใหม่"),
      place?.placeId ? safeCall(() => getPlaceDetails(place.placeId)) : null,
      safeCall(() => getTripadvisorLandmarks(destination), []),
      place?.tripadvisorLocationId ? safeCall(() => getTripadvisorReviews(place.tripadvisorLocationId), []) : [],
      place?.location ? safeCall(() => getTripadvisorNearby(place.location.lat, place.location.lng), []) : [],
    ]);

    res.json({
      plan,
      photoUrls: details?.photoUrls || [],
      placeName: details?.name || destination,
      landmarks,
      reviews,
      nearbyAttractions: nearby.filter((a) => a.category === "attraction"),
      attribution: {
        logoUrl: "https://www.tripadvisor.com/img/cdsi/img2/branding/tripadvisor_logo_115x18.gif",
        link: "https://www.tripadvisor.com",
      },
    });
  } catch (error) {
    next(error);
  }
};
