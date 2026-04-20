import time
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings

security = HTTPBearer(auto_error=False)
_jwks_cache: dict[str, Any] = {"keys": [], "loaded_at": 0.0}
JWKS_TTL_SECONDS = 3600


async def _get_jwks() -> list[dict[str, Any]]:
    now = time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["loaded_at"] < JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]

    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(settings.cognito_jwks_url)
        response.raise_for_status()
        keys = response.json().get("keys", [])

    _jwks_cache["keys"] = keys
    _jwks_cache["loaded_at"] = now
    return keys


async def verify_cognito_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing token key id",
            )

        keys = await _get_jwks()
        key = next((k for k in keys if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token key not found",
            )

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.cognito_issuer,
            options={"verify_aud": False},
        )

        token_use = payload.get("token_use")
        if token_use not in {"access", "id"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token use",
            )

        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials
    return await verify_cognito_token(token)
