import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { v2 } from "@google-cloud/translate";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Simple in-memory cache (สามารถเปลี่ยนเป็น Redis ได้)
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 ชั่วโมง

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, "../config/vertex-ai-key.json");
const auth = new GoogleAuth({ keyFilename: keyPath, scopes: "https://www.googleapis.com/auth/cloud-platform" });
const translate = new v2.Translate({ keyFilename: keyPath });

const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

export const getAccessToken = async () => {
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  } catch (error) {
    console.error("❌ Error fetching Vertex AI token:", error.message);
    throw new Error("Failed to fetch Vertex AI token");
  }
};

export const getAIResponse = async (userMessage) => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("ระบบขัดข้อง กรุณาลองใหม่ภายหลัง");
  try {
    const tonePrompt = `\nคุณคือ Tripster เป็นผู้ช่วยด้านการท่องเที่ยวภาคเหนือของประเทศไทย.\nตอบให้สั้น เข้าใจง่าย ใช้ภาษาสุภาพ เหมาะกับทุกเพศทุกวัย และตอบตามข้อเท็จจริง.\n`;
    const messages = [
      { role: "user", parts: [{ text: `${tonePrompt}\n\nคำถามของผู้ใช้: ${userMessage}` }] },
    ];
    const response = await axios.post(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.PROJECT_ID}/locations/us-central1/publishers/google/models/${modelName}:generateContent`,
      { contents: messages },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัย ฉันไม่สามารถให้ข้อมูลได้";
  } catch (error) {
    console.error("❌ Vertex AI error:", error.response?.data || error.message);
    throw new Error("ระบบมีปัญหา กรุณาลองใหม่");
  }
};

// --- Google Places API ---
export const getLocationFromGooglePlaces = async (placeName, type = "tourist_attraction") => {
  if (!placeName) return undefined;
  const cacheKey = `google_place_${placeName}_${type}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(placeName)}&inputtype=textquery&fields=place_id,name,geometry,types&key=${key}`;
  try {
    const res = await axios.get(url);
    const candidates = res.data.candidates;
    if (candidates && candidates.length > 0) {
      const place = {
        placeId: candidates[0].place_id,
        name: candidates[0].name,
        location: candidates[0].geometry?.location,
        types: candidates[0].types,
      };
      // ค้นหา Tripadvisor location เพื่อแมพ locationId
      const tripadvisorLocations = await searchTripadvisorLocations(placeName);
      if (tripadvisorLocations.length > 0) {
        place.tripadvisorLocationId = tripadvisorLocations[0].locationId;
      }
      cache.set(cacheKey, place);
      setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
      return place;
    }
    return undefined;
  } catch (error) {
    console.error("[Google Places API error]", error.response?.data || error.message);
    throw new Error("ไม่สามารถค้นหาสถานที่จาก Google Places ได้");
  }
};

export const getPlacePhotoUrl = (photoReference, maxwidth = 600) => {
  if (!photoReference) return null;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${photoReference}&key=${key}`;
};

export const getPlaceDetails = async (placeId) => {
  if (!placeId) return null;
  const cacheKey = `place_details_${placeId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,geometry,formatted_address,types&key=${key}`;
  try {
    const [googleRes, tripadvisorDetails] = await Promise.all([
      axios.get(url),
      getTripadvisorDetails(/* แมพ placeId เป็น locationId จาก getLocationFromGooglePlaces */),
    ]);
    const details = googleRes.data.result;
    let photoUrls = [];
    if (details?.photos && details.photos.length > 0) {
      photoUrls = details.photos.map(photo => getPlacePhotoUrl(photo.photo_reference));
    }

    // ดึงรูปจาก Tripadvisor
    const tripadvisorPhotos = tripadvisorDetails?.locationId
      ? await getTripadvisorPhotos(tripadvisorDetails.locationId)
      : [];

    const result = {
      ...details,
      photoUrls: [...photoUrls, ...tripadvisorPhotos],
      tripadvisorDetails: tripadvisorDetails || {},
    };
    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return result;
  } catch (error) {
    console.error("[Place Details error]", error.response?.data || error.message);
    throw new Error("ไม่สามารถดึงรายละเอียดสถานที่ได้");
  }
};

// --- Tripadvisor API ---
export const searchTripadvisorLocations = async (query) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !query) return [];
  const cacheKey = `tripadvisor_search_${query}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/search?query=${encodeURIComponent(query)}&language=th`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Referer': 'https://tripsterai.onrender.com'
      },
    });
    const locations = response.data?.data?.map(item => ({
      locationId: item.location_id,
      name: item.name,
      address: item.address_obj?.address_string || '',
    })) || [];
    cache.set(cacheKey, locations);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return locations;
  } catch (error) {
    console.error('[Tripadvisor Search API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorDetails = async (locationId) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !locationId) return null;
  const cacheKey = `tripadvisor_details_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?language=th¤cy=THB`;
    const response = await axios.get(url, {
      headers: { 'X-TripAdvisor-API-Key': apiKey, 'Accept': 'application/json' },
    });
    const result = { ...response.data, locationId };
    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return result;
  } catch (error) {
    console.error('[Tripadvisor Details API error]', error.response?.data || error.message);
    return null;
  }
};

export const getTripadvisorPhotos = async (locationId) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !locationId) return [];
  const cacheKey = `tripadvisor_photos_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos?language=th`;
    const response = await axios.get(url, {
      headers: { 'X-TripAdvisor-API-Key': apiKey, 'Accept': 'application/json' },
    });
    const photos = response.data?.data?.map(photo => photo.images?.large?.url || photo.images?.original?.url) || [];
    cache.set(cacheKey, photos);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return photos;
  } catch (error) {
    console.error('[Tripadvisor Photos API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorReviews = async (locationId) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !locationId) return [];
  const cacheKey = `tripadvisor_reviews_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/reviews?language=th`;
    const response = await axios.get(url, {
      headers: { 'X-TripAdvisor-API-Key': apiKey, 'Accept': 'application/json' },
    });
    const reviews = response.data?.data?.map(review => ({
      text: review.text,
      rating: review.rating,
      author: review.user?.username || 'Anonymous',
      date: review.published_date,
    })) || [];
    cache.set(cacheKey, reviews);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return reviews;
  } catch (error) {
    console.error('[Tripadvisor Reviews API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorNearby = async (lat, lng) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !lat || !lng) return [];
  const cacheKey = `tripadvisor_nearby_${lat}_${lng}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/nearby_search?latLong=${lat},${lng}&language=th`;
    const response = await axios.get(url, {
      headers: { 'X-TripAdvisor-API-Key': apiKey, 'Accept': 'application/json' },
    });
    const nearby = response.data?.data?.map(item => ({
      locationId: item.location_id,
      name: item.name,
      distance: item.distance,
      category: item.category?.name || '',
    })) || [];
    cache.set(cacheKey, nearby);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return nearby;
  } catch (error) {
    console.error('[Tripadvisor Nearby Search API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorLandmarks = async (destination) => {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  if (!apiKey || !destination) return [];
  try {
    // 1. ค้นหา locationId
    const searchRes = await axios.get('https://api.content.tripadvisor.com/api/v1/location/search', {
      params: {
        key: apiKey,
        searchQuery: destination,
        language: 'en'
      }
    });
    const locations = searchRes.data.data || [];
    if (locations.length === 0) return [];
    // 2. ดึงรูปจาก locationId แรก
    const locationId = locations[0].location_id;
    const photosRes = await axios.get(`https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos`, {
      params: {
        key: apiKey,
        language: 'en'
      }
    });
    const photos = photosRes.data.data || [];
    // 3. map ข้อมูล
    return photos.map(photo => ({
      name: locations[0].name, // หรือ photo.caption ถ้ามี
      image: photo.images?.original?.url || photo.images?.large?.url || null,
      description: photo.caption || '',
      link: locations[0].web_url || ''
    })).filter(l => l.image && l.name);
  } catch (e) {
    console.error('[Tripadvisor Landmarks API error]', e?.response?.data || e.message);
    return [];
  }
};

// ฟังก์ชัน getHotelsNearPlace และ searchPlaceWithCustomSearch คงเดิม (ถ้าต้องการปรับปรุง บอกมาได้เลย)
export const getHotelsNearPlace = async (placeName) => { /* คงเดิม */ };
export const searchPlaceWithCustomSearch = async (placeName, context = "สถานที่ท่องเที่ยว") => { /* คงเดิม */ };
