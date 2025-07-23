import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { v2 as TranslateV2 } from "@google-cloud/translate";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache
const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";
const cache = new Map();

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
const credentials = JSON.parse(keyPath);
const auth = new GoogleAuth({ credentials, scopes: "https://www.googleapis.com/auth/cloud-platform" });
const translate = new TranslateV2.Translate({ credentials });

const withCache = async (key, fetcher) => {
  if (cache.has(key)) return cache.get(key);
  const data = await fetcher();
  cache.set(key, data);
  setTimeout(() => cache.delete(key), CACHE_DURATION);
  return data;
};

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
    const messages = [
      {
        role: "user",
        parts: [{
          text: `\nคุณคือ Tripster เป็นผู้ช่วยด้านการท่องเที่ยวภาคเหนือของประเทศไทย.\nตอบให้สั้น เข้าใจง่าย ใช้ภาษาสุภาพ เหมาะกับทุกเพศทุกวัย และตอบตามข้อเท็จจริง.\n\nคำถามของผู้ใช้: ${userMessage}`,
        }],
      },
    ];
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.PROJECT_ID}/locations/us-central1/publishers/google/models/${modelName}:generateContent`;
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const response = await axios.post(url, { contents: messages }, { headers });
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัย ฉันไม่สามารถให้ข้อมูลได้";
  } catch (error) {
    console.error("❌ Vertex AI error:", error.response?.data || error.message);
    throw new Error("ระบบมีปัญหา กรุณาลองใหม่");
  }
};

export const getLocationFromGooglePlaces = async (placeName, type = "tourist_attraction") => {
  if (!placeName) return undefined;
  const cacheKey = `google_place_${placeName}_${type}`;
  return withCache(cacheKey, async () => {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(placeName)}&inputtype=textquery&fields=place_id,name,geometry,types&key=${key}`;
    const res = await axios.get(url);
    const candidate = res.data.candidates?.[0];
    if (!candidate) return undefined;

    const place = {
      placeId: candidate.place_id,
      name: candidate.name,
      location: candidate.geometry?.location,
      types: candidate.types,
    };

    const tripadvisor = await searchTripadvisorLocations(placeName);
    if (tripadvisor.length > 0) {
      place.tripadvisorLocationId = tripadvisor[0].locationId;
    }
    return place;
  });
};

export const getPlacePhotoUrl = (photoReference, maxwidth = 600) => {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
};

export const getPlaceDetails = async (placeId) => {
  if (!placeId) return null;
  const cacheKey = `place_details_${placeId}`;
  return withCache(cacheKey, async () => {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,geometry,formatted_address,types&key=${key}`;

    // ตอนนี้ยังไม่ได้ map placeId -> locationId จริงๆ ให้ข้ามไว้ก่อน
    const [googleRes, tripadvisorDetails] = await Promise.all([
      axios.get(url),
      Promise.resolve(null),
    ]);

    const details = googleRes.data.result;
    const googlePhotos = details.photos?.map(p => getPlacePhotoUrl(p.photo_reference)) || [];
    const tripPhotos = tripadvisorDetails?.locationId ? await getTripadvisorPhotos(tripadvisorDetails.locationId) : [];

    return {
      ...details,
      photoUrls: [...googlePhotos, ...tripPhotos],
      tripadvisorDetails: tripadvisorDetails || {},
    };
  });
};

// --- Tripadvisor API ---

const tripadvisorHeaders = {
  Accept: "application/json",
  Referer: "https://tripsterai.onrender.com",
};

export const searchTripadvisorLocations = async (query) => {
  if (!query) return [];
  const cacheKey = `tripadvisor_search_${query}`;
  return withCache(cacheKey, async () => {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.content.tripadvisor.com/api/v1/location/search?query=${encodeURIComponent(query)}&language=th&key=${apiKey}`;

    const response = await axios.get(url, { headers: tripadvisorHeaders });
    const locations = response.data?.data?.map(item => ({
      locationId: item.location_id,
      name: item.name,
      address: item.address_obj?.address_string || "",
    })) || [];
    return locations;
  });
};

export const getTripadvisorLandmarks = async (query) => {
  if (!query) return [];
  const cacheKey = `tripadvisor_landmarks_${query}`;
  return withCache(cacheKey, async () => {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.content.tripadvisor.com/api/v1/location/search?query=${encodeURIComponent(query)}&language=th&key=${apiKey}`;

    const response = await axios.get(url, { headers: tripadvisorHeaders });
    const locations = response.data?.data || [];

    // กรอง landmark / attraction ที่เกี่ยวข้อง
    return locations.filter(item =>
      item.category === "attraction" || item.result_type === "things_to_do"
    );
  });
};

export const getTripadvisorPhotos = async (locationId) => {
  if (!locationId) return [];
  const cacheKey = `tripadvisor_photos_${locationId}`;
  return withCache(cacheKey, async () => {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos?language=th&key=${apiKey}`;

    const response = await axios.get(url, { headers: tripadvisorHeaders });
    const photos = response.data?.data?.map(photo => photo.images?.large?.url || photo.images?.original?.url) || [];
    return photos;
  });
};

export const getTripadvisorReviews = async (locationId) => {
  if (!locationId) return [];
  const cacheKey = `tripadvisor_reviews_${locationId}`;
  return withCache(cacheKey, async () => {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/reviews?language=th&key=${apiKey}`;

    const response = await axios.get(url, { headers: tripadvisorHeaders });
    const reviews = response.data?.data?.map(review => ({
      text: review.text,
      rating: review.rating,
      author: review.user?.username || "Anonymous",
      date: review.published_date,
    })) || [];
    return reviews;
  });
};

export const getTripadvisorNearby = async (lat, lng) => {
  if (!lat || !lng) return [];
  const cacheKey = `tripadvisor_nearby_${lat}_${lng}`;
  return withCache(cacheKey, async () => {
    const apiKey = process.env.TRIPADVISOR_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.content.tripadvisor.com/api/v1/location/nearby_search?latLong=${lat},${lng}&language=th&key=${apiKey}`;

    const response = await axios.get(url, { headers: tripadvisorHeaders });
    const nearby = response.data?.data?.map(item => ({
      locationId: item.location_id,
      name: item.name,
      distance: item.distance,
      category: item.category?.name || "",
    })) || [];
    return nearby;
  });
};

// Export all functions
export {
  getAccessToken,
  getAIResponse,
  getLocationFromGooglePlaces,
  getPlacePhotoUrl,
  getPlaceDetails,
  searchTripadvisorLocations,
  getTripadvisorLandmarks,
  getTripadvisorPhotos,
  getTripadvisorReviews,
  getTripadvisorNearby,
};
