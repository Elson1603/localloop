import base64

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.config import get_settings
from app.core.security import get_current_user
from app.schemas.ai import (
    PriceSuggestionRequest,
    PriceSuggestionResponse,
    ProductDescriptionSuggestionResponse,
)
from app.services.ai_service import JsonAiService

router = APIRouter(prefix="/ai", tags=["ai"])


def _get_ai_service() -> tuple[str, JsonAiService]:
    # Reload settings to pick up env changes during local development.
    get_settings.cache_clear()
    settings = get_settings()
    provider = settings.ai_provider.strip().lower() or "google"

    if provider == "openrouter":
        api_key = settings.openrouter_api_key.strip()
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPENROUTER_API_KEY is not configured",
            )
        service = JsonAiService(
            provider="openrouter",
            api_key=api_key,
            model=settings.openrouter_model,
            site_url=settings.openrouter_site_url,
            app_name=settings.openrouter_app_name,
        )
        return provider, service

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY is not configured",
        )

    service = JsonAiService(
        provider="google",
        api_key=api_key,
        model=settings.gemini_model,
    )
    return provider, service


def _raise_for_provider_http_error(provider: str, exc: httpx.HTTPStatusError, fallback_message: str) -> None:
    provider_name = "OpenRouter" if provider == "openrouter" else "Gemini"
    status_code = exc.response.status_code
    detail = fallback_message
    try:
        payload = exc.response.json()
        message = payload.get("error", {}).get("message")
        if not message and isinstance(payload.get("message"), str):
            message = payload.get("message")
        if isinstance(message, str) and message.strip():
            detail = message.strip()
    except Exception:
        pass

    if status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"{provider_name} quota/rate limit reached: {detail}",
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"{provider_name} API error ({status_code}): {detail}",
    ) from exc


@router.post("/price-suggestion", response_model=PriceSuggestionResponse)
async def suggest_price(
    payload: PriceSuggestionRequest,
    current_user: dict = Depends(get_current_user),
) -> PriceSuggestionResponse:
    del current_user
    provider, service = _get_ai_service()

    prompt = f"""
You are helping generate a resale marketplace price suggestion.
Return STRICT JSON only with this exact schema:
{{
  "min_price": number,
  "max_price": number,
  "reason": string
}}
Rules:
- currency is {payload.currency}
- min_price and max_price must be positive numbers
- max_price must be >= min_price
- reason must be concise, practical, and max 2 sentences
Inputs:
- title: {payload.title}
- category: {payload.category}
- condition: {payload.condition or 'Not specified'}
- location: {payload.location or 'Not specified'}
- description: {payload.description or 'Not specified'}
""".strip()

    try:
        result = await service.generate_json(prompt)
        min_price = float(result.get("min_price", 0))
        max_price = float(result.get("max_price", 0))
        reason = str(result.get("reason", "")).strip()

        if min_price <= 0 or max_price <= 0:
            raise ValueError("Gemini returned invalid prices")

        if max_price < min_price:
            min_price, max_price = max_price, min_price

        if not reason:
            reason = "Suggested from title, condition, category, and nearby market context."

        return PriceSuggestionResponse(min_price=min_price, max_price=max_price, reason=reason)
    except httpx.HTTPStatusError as exc:
        _raise_for_provider_http_error(provider, exc, "Failed to fetch price suggestion")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Price suggestion failed: {str(exc)}",
        ) from exc


@router.post("/product-description", response_model=ProductDescriptionSuggestionResponse)
async def suggest_product_description(
    title: str = Form(..., min_length=3, max_length=120),
    category: str = Form(..., min_length=2, max_length=50),
    condition: str = Form(default="", max_length=80),
    location: str = Form(default="", max_length=120),
    image: UploadFile | None = File(default=None),
    current_user: dict = Depends(get_current_user),
) -> ProductDescriptionSuggestionResponse:
    del current_user
    provider, service = _get_ai_service()

    image_base64: str | None = None
    image_mime_type: str | None = None

    if image is not None:
        mime = image.content_type or ""
        if not mime.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are supported")

        image_bytes = await image.read()
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 10MB or smaller")

        image_base64 = base64.b64encode(image_bytes).decode("ascii")
        image_mime_type = mime

    prompt = f"""
You are helping write a marketplace listing.
Return STRICT JSON only with this exact schema:
{{
  "description": string,
  "keywords": string[]
}}
Rules:
- description should be attractive, realistic, and between 60 and 220 characters
- do not invent model numbers or specs not implied by input
- include condition context if provided
- keywords should be 4 to 8 short search-friendly terms
Inputs:
- title: {title}
- category: {category}
- condition: {condition or 'Not specified'}
- location: {location or 'Not specified'}
- image_attached: {'yes' if image_base64 else 'no'}
""".strip()

    try:
        result = await service.generate_json(
            prompt=prompt,
            image_base64=image_base64,
            image_mime_type=image_mime_type,
        )

        description = str(result.get("description", "")).strip()
        keywords_raw = result.get("keywords", [])
        keywords = [str(item).strip() for item in keywords_raw if str(item).strip()]

        if not description:
            raise ValueError("Gemini returned empty description")

        if len(description) > 500:
            description = description[:500].rstrip()

        if len(description) < 20:
            raise ValueError("Gemini returned very short description")

        return ProductDescriptionSuggestionResponse(description=description, keywords=keywords[:8])
    except httpx.HTTPStatusError as exc:
        _raise_for_provider_http_error(provider, exc, "Failed to generate description")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Description generation failed: {str(exc)}",
        ) from exc
