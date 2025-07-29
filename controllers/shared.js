import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { v2 } from "@google-cloud/translate";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 ชั่วโมง

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// กำหนด keyPath และจัดการทั้ง JSON string และพาธไฟล์
let keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "./config/vertex-ai-key.json");
if (!keyPath) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS or vertex-ai-key.json file at ./config/vertex-ai-key.json');

// ตรวจสอบว่า keyPath เป็น JSON string หรือพาธไฟล์
let credentials;
try {
  credentials = typeof keyPath === 'string' && !keyPath.includes('\\') && !keyPath.includes('/') 
    ? JSON.parse(keyPath) 
    : { keyFilename: keyPath };
} catch (e) {
  credentials = { keyFilename: keyPath };
}

const auth = new GoogleAuth({ credentials, scopes: "https://www.googleapis.com/auth/cloud-platform" });
const translate = new v2.Translate({ credentials });

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
    const place = await getLocationFromGooglePlaces(placeId);
    const tripadvisorLocationId = place?.tripadvisorLocationId;
    const [googleRes, tripadvisorDetails] = await Promise.all([
      axios.get(url),
      tripadvisorLocationId ? getTripadvisorDetails(tripadvisorLocationId) : Promise.resolve(null),
    ]);
    const details = googleRes.data.result;
    let photoUrls = [];
    if (details?.photos && details.photos.length > 0) {
      photoUrls = details.photos.map(photo => getPlacePhotoUrl(photo.photo_reference));
    }

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

// --- RapidAPI for TripAdvisor Data ---
export const searchTripadvisorLocations = async (query) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !query) return [];
  const cacheKey = `tripadvisor_search_${query}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const options = {
      method: 'GET',
      url: 'https://tripadvisor-com1.p.rapidapi.com/locations/search',
      params: { query: encodeURIComponent(query), language: 'th' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
    const locations = response.data?.data?.map(item => ({
      locationId: item.result_object.location_id,
      name: item.result_object.name,
      address: item.result_object.address || '',
    })) || [];
    cache.set(cacheKey, locations);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return locations;
  } catch (error) {
    console.error('[RapidAPI Search API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorDetails = async (locationId) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !locationId) return null;
  const cacheKey = `tripadvisor_details_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const options = {
      method: 'GET',
      url: `https://tripadvisor-com1.p.rapidapi.com/locations/details`,
      params: { locationId, language: 'th', currency: 'THB' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
    const result = { ...response.data, locationId };
    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return result;
  } catch (error) {
    console.error('[RapidAPI Details API error]', error.response?.data || error.message);
    return null;
  }
};

export const getTripadvisorPhotos = async (locationId) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !locationId) return [];
  const cacheKey = `tripadvisor_photos_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const options = {
      method: 'GET',
      url: `https://tripadvisor-com1.p.rapidapi.com/photos/get`,
      params: { locationId, language: 'th' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
    const photos = response.data?.data?.map(photo => photo.images?.large?.url || photo.images?.original?.url) || [];
    cache.set(cacheKey, photos);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return photos;
  } catch (error) {
    console.error('[RapidAPI Photos API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorReviews = async (locationId) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !locationId) return [];
  const cacheKey = `tripadvisor_reviews_${locationId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const options = {
      method: 'GET',
      url: `https://tripadvisor-com1.p.rapidapi.com/reviews/get`,
      params: { locationId, language: 'th' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
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
    console.error('[RapidAPI Reviews API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorNearby = async (lat, lng) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !lat || !lng) return [];
  const cacheKey = `tripadvisor_nearby_${lat}_${lng}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const options = {
      method: 'GET',
      url: `https://tripadvisor-com1.p.rapidapi.com/nearby-search`,
      params: { latLong: `${lat},${lng}`, language: 'th', units: 'kilometers' },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
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
    console.error('[RapidAPI Nearby Search API error]', error.response?.data || error.message);
    return [];
  }
};

export const getTripadvisorLandmarks = async (destination) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || !destination) return [];
  const cacheKey = `tripadvisor_landmarks_${destination}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const locations = await searchTripadvisorLocations(destination);
    if (locations.length === 0) return [];

    const locationId = locations[0].locationId;
    const options = {
      method: 'GET',
      url: `https://tripadvisor-com1.p.rapidapi.com/attractions/search`,
      params: {
        geoId: locationId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        language: 'th',
        currency: 'THB',
        units: 'kilometers',
        page: '1',
        sortType: 'asc',
        adults: '2'
      },
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
    const landmarks = response.data?.data?.map(item => ({
      name: item.name,
      image: item.photo?.images?.large?.url || null,
      description: item.description || '',
      link: item.web_url || ''
    })) || [];

    cache.set(cacheKey, landmarks);
    setTimeout(() => cache.delete(cacheKey), CACHE_DURATION);
    return landmarks;
  } catch (e) {
    console.error('[RapidAPI Landmarks API error]', e.response?.data || e.message);
    return [];
  }
};

export const getHotelsNearPlace = async (placeName) => { /* คงเดิม */ };
export const searchPlaceWithCustomSearch = async (placeName, context = "สถานที่ท่องเที่ยว") => { /* คงเดิม */ };
