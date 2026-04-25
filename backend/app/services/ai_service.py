import json
import re
from typing import Any

import httpx


class JsonAiService:
    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        site_url: str = "",
        app_name: str = "LocalLoop",
    ) -> None:
        self.provider = provider.lower()
        self.model = model
        self.api_key = api_key
        self.site_url = site_url
        self.app_name = app_name
        self.google_base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.openrouter_base_url = "https://openrouter.ai/api/v1"

    def _parse_json_text(self, raw_text: str) -> dict[str, Any]:
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned)
        cleaned = re.sub(r"\\s*```$", "", cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Some providers prepend explanations before JSON. Extract the outer JSON object.
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(cleaned[start : end + 1])
            raise

    def _extract_google_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates", [])
        if not candidates:
            raise ValueError("Google model returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        text = "\n".join(part for part in text_parts if part).strip()
        if not text:
            raise ValueError("Google model returned empty text")
        return text

    def _extract_openrouter_text(self, payload: dict[str, Any]) -> str:
        choices = payload.get("choices", [])
        if not choices:
            raise ValueError("OpenRouter returned no choices")

        message = choices[0].get("message", {})
        content = message.get("content", "")

        if isinstance(content, str):
            text = content.strip()
            if not text:
                raise ValueError("OpenRouter returned empty text")
            return text

        if isinstance(content, list):
            text_parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    piece = str(item.get("text", "")).strip()
                    if piece:
                        text_parts.append(piece)
            text = "\n".join(text_parts).strip()
            if not text:
                raise ValueError("OpenRouter returned empty content list")
            return text

        raise ValueError("OpenRouter content format is unsupported")

    async def _generate_with_google(
        self,
        prompt: str,
        image_base64: str | None,
        image_mime_type: str | None,
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

        endpoint = f"{self.google_base_url}/models/{self.model}:generateContent"
        params = {"key": self.api_key}
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(endpoint, params=params, json=body)
            response.raise_for_status()
            payload = response.json()

        return self._parse_json_text(self._extract_google_text(payload))

    async def _generate_with_openrouter(
        self,
        prompt: str,
        image_base64: str | None,
        image_mime_type: str | None,
    ) -> dict[str, Any]:
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        if image_base64 and image_mime_type:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_mime_type};base64,{image_base64}",
                    },
                }
            )

        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.3,
        }

        headers: dict[str, str] = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name

        endpoint = f"{self.openrouter_base_url}/chat/completions"
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(endpoint, headers=headers, json=body)
            response.raise_for_status()
            payload = response.json()

        return self._parse_json_text(self._extract_openrouter_text(payload))

    async def generate_json(
        self,
        prompt: str,
        image_base64: str | None = None,
        image_mime_type: str | None = None,
    ) -> dict[str, Any]:
        if self.provider == "openrouter":
            return await self._generate_with_openrouter(prompt, image_base64, image_mime_type)

        return await self._generate_with_google(prompt, image_base64, image_mime_type)
