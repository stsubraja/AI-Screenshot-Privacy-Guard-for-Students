import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScanResult, PIIType } from "../types";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyA-P0O838qtw8L8S5BUv9vzzW5LpS47ef4"
});

/**
 * Resizes a base64 image to a maximum dimension while maintaining aspect ratio.
 * Increased to 1600px for better detection of small text.
 */
async function resizeImage(base64Str: string, maxDimension: number = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.9)); // Higher quality for OCR
    };
    img.src = base64Str;
  });
}

export async function scanImage(base64Image: string): Promise<ScanResult> {
  const model = "gemini-3-flash-preview";
  
  // Resize image to speed up upload and processing
  const optimizedImage = await resizeImage(base64Image);
  
  const prompt = `
    CRITICAL MISSION: Thoroughly scan this screenshot for EVERY piece of sensitive personal information (PII).
    Do not miss anything. Look for small text, background text, and obscured data.
    Be extremely aggressive: if it looks even slightly like personal data, extract it.
    
    Detect and categorize:
    - phone: Phone numbers (all formats)
    - email: Email addresses
    - student_id: IDs, employee numbers, account numbers, license plates
    - address: Physical addresses, locations, GPS coordinates
    - name: Full names, usernames, profile names, signatures
    - credit_card: Credit card numbers, CVV, expiry dates, bank account numbers
    - ssn: Social security numbers, tax IDs, national IDs
    - password: Passwords, API keys, secrets, tokens, recovery codes
    - ip_address: IP addresses, MAC addresses
    - username: Handles, logins, nicknames
    - other: Any other sensitive data (DOB, medical info, financial details, etc.)
    
    Return JSON with:
    1. detections: Array of {type, text, box: {ymin, xmin, ymax, xmax}}
       - Coordinates: 0-1000 normalized
    2. riskScore: Low, Medium, or High
    3. summary: Detailed privacy impact summary
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: optimizedImage.split(",")[1],
          },
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: Object.values(PIIType) },
                text: { type: Type.STRING },
                box: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER },
                  },
                  required: ["ymin", "xmin", "ymax", "xmax"],
                },
              },
              required: ["type", "text", "box"],
            },
          },
          riskScore: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          summary: { type: Type.STRING },
        },
        required: ["detections", "riskScore", "summary"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}") as ScanResult;
  
  // Add unique IDs to detections and redact by default
  result.detections = (result.detections || []).map((d, i) => ({
    ...d,
    id: `pii-${i}`,
    redacted: true,
  }));

  return result;
}
