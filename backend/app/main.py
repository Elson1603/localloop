from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.chats import router as chats_router
from app.api.offers import router as offers_router
from app.api.products import router as products_router
from app.api.storage import router as storage_router
from app.api.users import router as users_router
from app.api.notifications import router as notifications_router
from app.core.config import get_settings


def _dedupe_origins(origins: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for origin in origins:
        if origin not in seen:
            deduped.append(origin)
            seen.add(origin)
    return deduped


def _build_cors_config() -> tuple[list[str], str | None, bool]:
    allowed_origins = settings.cors_allowed_origins_list.copy()
    allow_origin_regex = settings.cors_allowed_origin_regex.strip() or None

    if settings.cors_allow_localhost:
        allowed_origins.extend(
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8080",
                "http://127.0.0.1:8080",
            ]
        )
        localhost_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        allow_origin_regex = (
            f"({allow_origin_regex})|({localhost_regex})"
            if allow_origin_regex
            else localhost_regex
        )

    allowed_origins = _dedupe_origins([origin for origin in allowed_origins if origin])
    allow_credentials = True

    if "*" in allowed_origins:
        allowed_origins = ["*"]
        allow_origin_regex = None
        allow_credentials = False

    return allowed_origins, allow_origin_regex, allow_credentials

settings = get_settings()
app = FastAPI(title=settings.project_name)

cors_allow_origins, cors_allow_origin_regex, cors_allow_credentials = _build_cors_config()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_origin_regex=cors_allow_origin_regex,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}




app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(products_router, prefix=settings.api_prefix)
app.include_router(chats_router, prefix=settings.api_prefix)
app.include_router(offers_router, prefix=settings.api_prefix)
app.include_router(storage_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)
app.include_router(ai_router, prefix=settings.api_prefix)

handler = Mangum(app)