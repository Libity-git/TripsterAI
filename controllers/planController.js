import { getAIResponse, getPlaceDetails, getLocationFromGooglePlaces, getTripadvisorLandmarks, getTripadvisorReviews, getTripadvisorNearby } from "./shared.js";

export const createPlan = async (req, res, next) => {
  try {
    const { startLocation, destination, days, budget, travelWith, preference, interests } = req.body;
    if (!startLocation || !destination || !budget) {
      return res.status(400).json({ error: "กรุณาระบุข้อมูลที่จำเป็น: จุดเริ่มต้น, ปลายทาง, และงบประมาณ" });
    }
    const aiPrompt = `\nช่วยวางแผนการท่องเที่ยวจาก ${startLocation} ไป ${destination} จำนวน ${days || 3} วัน งบประมาณ ${budget} บาท สไตล์: ${preference || "-"} ความสนใจ: ${interests || "-"}`;
    const place = await getLocationFromGooglePlaces(destination).catch(() => null);

    let plan, details, landmarks, reviews, nearbyAttractions;
    try {
      [plan, details, landmarks, reviews, nearbyAttractions] = await Promise.all([
        getAIResponse(aiPrompt),
        place?.placeId ? getPlaceDetails(place.placeId) : Promise.resolve(null),
        getTripadvisorLandmarks(destination),
        place?.tripadvisorLocationId ? getTripadvisorReviews(place.tripadvisorLocationId) : Promise.resolve([]),
        place?.location ? getTripadvisorNearby(place.location.lat, place.location.lng) : Promise.resolve([]),
      ]);
    } catch (error) {
      console.error("Error in Promise.all:", error.message);
      plan = plan || "ขออภัย ฉันไม่สามารถให้แผนได้ กรุณาลองใหม่";
      details = details || null;
      landmarks = landmarks || [];
      reviews = reviews || [];
      nearbyAttractions = nearbyAttractions || [];
    }

    res.json({
      plan,
      photoUrls: details?.photoUrls || [],
      placeName: details?.name || destination,
      landmarks,
      reviews,
      nearbyAttractions: nearbyAttractions.filter(a => a.category === 'attraction'),
      attribution: {
        logoUrl: "https://www.tripadvisor.com/img/cdsi/img2/branding/tripadvisor_logo_115x18.gif",
        link: "https://www.tripadvisor.com"
      }
    });
  } catch (error) {
    next(error);
  }
};
