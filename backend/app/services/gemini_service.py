import json
import re
from typing import Any

import httpx


class GeminiService:
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash") -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        text = "\n".join(part for part in text_parts if part).strip()
        if not text:
            raise ValueError("Gemini returned empty text")
        return text

    def _parse_json_text(self, raw_text: str) -> dict[str, Any]:
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned)
        cleaned = re.sub(r"\\s*```$", "", cleaned)
        return json.loads(cleaned)

    async def generate_json(
        self,
        prompt: str,
        image_base64: str | None = None,
        image_mime_type: str | None = None,
    ) -> dict[str, Any]:
        parts: list[dict[str, Any]] = [{"text": prompt}]
        if image_base64 and image_mime_type:
            parts.append(
                {
                    "inlineData": {
                        "mimeType": image_mime_type,
                        "data": image_base64,
                    }
                }
            )

        body = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3,
            },
        }

        endpoint = f"{self.base_url}/models/{self.model}:generateContent"
        params = {"key": self.api_key}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(endpoint, params=params, json=body)
            response.raise_for_status()
            payload = response.json()

        raw_text = self._extract_text(payload)
        return self._parse_json_text(raw_text)
