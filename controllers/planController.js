import { getAIResponse, getPlaceDetails, getLocationFromGooglePlaces, getTripadvisorLandmarks, getTripadvisorReviews, getTripadvisorNearby } from "./shared.js";

export const createPlan = async (req, res, next) => {
  try {
    const { startLocation, destination, days, budget, travelWith, preference, interests } = req.body;
    if (!startLocation || !destination || !budget) {
      return res.status(400).json({ error: "กรุณาระบุข้อมูลที่จำเป็น: จุดเริ่มต้น, ปลายทาง, และงบประมาณ" });
    }
    const aiPrompt = `\nช่วยวางแผนการท่องเที่ยวจาก ${startLocation} ไป ${destination} จำนวน ${days || 3} วัน งบประมาณ ${budget} บาท สไตล์: ${preference || "-"} ความสนใจ: ${interests || "-"}`;
    const place = await getLocationFromGooglePlaces(destination).catch(() => null);

    const [plan, details, landmarks, reviews, nearbyAttractions] = await Promise.all([
      getAIResponse(aiPrompt).catch(() => "ขออภัย ฉันไม่สามารถให้แผนได้ กรุณาลองใหม่"),
      place?.placeId ? getPlaceDetails(place.placeId).catch(() => null) : null,
      getTripadvisorLandmarks(destination).catch(() => []),
      place?.tripadvisorLocationId ? getTripadvisorReviews(place.tripadvisorLocationId).catch(() => []) : [],
      place?.location ? getTripadvisorNearby(place.location.lat, place.location.lng).catch(() => []),
    ].map(p => p.catch(e => { console.error(e.message); return e.fallback || null; })));

    res.json({
      plan,
      photoUrls: details?.photoUrls || [],
      placeName: details?.name || destination,
      landmarks,
      reviews,
      nearbyAttractions: nearbyAttractions.filter(a => a.category === 'attraction'),
      attribution: {
        logoUrl: "https://www.tripadvisor.com/img/cdsi/img2/branding/tripadvisor_logo_115x18.gif", // ตัวอย่าง URL ตาม Display Requirements
        link: "https://www.tripadvisor.com"
      }
    });
  } catch (error) {
    next(error);
  }
};
