import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { v2 } from "@google-cloud/translate";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
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
    return null;
  }
};

export const getAIResponse = async (userMessage) => {
  const accessToken = await getAccessToken();
  if (!accessToken) return "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง";
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
    return "ระบบมีปัญหา กรุณาลองใหม่";
  }
};

// --- Google Places API ---
export const getLocationFromGooglePlaces = async (placeName, type = "tourist_attraction") => {
  if (!placeName) return undefined;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(placeName)}&inputtype=textquery&fields=place_id,name,geometry,types&key=${key}`;
  const res = await axios.get(url);
  const candidates = res.data.candidates;
  if (candidates && candidates.length > 0) {
    return {
      placeId: candidates[0].place_id,
      name: candidates[0].name,
      location: candidates[0].geometry?.location,
      types: candidates[0].types,
    };
  }
  return undefined;
};
export const getPlacePhotoUrl = (photoReference, maxwidth = 600) => {
  if (!photoReference) return null;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${photoReference}&key=${key}`;
};

export const getPlaceDetails = async (placeId) => {
  if (!placeId) return null;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,geometry,formatted_address,types&key=${key}`;
  const res = await axios.get(url);
  const details = res.data.result;
  let photoUrls = [];
  if (details?.photos && details.photos.length > 0) {
    photoUrls = details.photos.map(photo =>
      getPlacePhotoUrl(photo.photo_reference)
    );
  }
  return {
    ...details,
    photoUrls,
  };
};
export const getHotelsNearPlace = async (placeName) => {
  // ... (เหมือน server.js)
};
export const searchPlaceWithCustomSearch = async (placeName, context = "สถานที่ท่องเที่ยว") => {
  // ... (เหมือน server.js)
}; 