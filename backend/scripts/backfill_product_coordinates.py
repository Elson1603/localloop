from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3

from app.core.config import get_settings


KNOWN_LOCATION_COORDS: dict[str, tuple[float, float]] = {
    "koramangala": (12.9352, 77.6245),
    "indiranagar": (12.9784, 77.6408),
    "hsr layout": (12.9116, 77.6474),
    "jp nagar": (12.9081, 77.5852),
    "btm": (12.9166, 77.6101),
    "whitefield": (12.9698, 77.7500),
}

FALLBACK_CITY_CENTER: tuple[float, float] = (12.9716, 77.5946)


@dataclass
class BackfillStats:
    scanned: int = 0
    already_present: int = 0
    inferred: int = 0
    updated: int = 0
    skipped_no_location: int = 0
    skipped_unresolved: int = 0
    failed: int = 0


def _normalize_location(raw: str) -> str:
    return raw.strip().lower()


def _is_valid_lat_lng(latitude: Any, longitude: Any) -> bool:
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180


def _parse_lat_lng_from_text(location: str) -> tuple[float, float] | None:
    lat_lng_pattern = re.compile(
        r"lat\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[, ]+lng\s*[:=]?\s*(-?\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )
    pair_pattern = re.compile(r"(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)")

    match = lat_lng_pattern.search(location)
    if not match:
        match = pair_pattern.search(location)
    if not match:
        return None

    lat = float(match.group(1))
    lng = float(match.group(2))
    if not _is_valid_lat_lng(lat, lng):
        return None
    return (lat, lng)


def _infer_coordinates(location: str, use_fallback_center: bool) -> tuple[float, float] | None:
    parsed = _parse_lat_lng_from_text(location)
    if parsed:
        return parsed

    normalized = _normalize_location(location)
    direct = KNOWN_LOCATION_COORDS.get(normalized)
    if direct:
        return direct

    for key, value in KNOWN_LOCATION_COORDS.items():
        if key in normalized:
            return value
    if use_fallback_center:
        return FALLBACK_CITY_CENTER
    return None


def _get_products_table():
    settings = get_settings()
    session = boto3.session.Session(
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token,
        region_name=settings.aws_region,
    )
    dynamodb = session.resource("dynamodb")
    return dynamodb.Table(settings.products_table_name)


def run_backfill(apply_changes: bool, use_fallback_center: bool) -> BackfillStats:
    table = _get_products_table()
    stats = BackfillStats()
    last_evaluated_key: dict[str, Any] | None = None

    while True:
        scan_kwargs: dict[str, Any] = {
            "ProjectionExpression": "product_id, #loc, latitude, longitude",
            "ExpressionAttributeNames": {"#loc": "location"},
        }
        if last_evaluated_key:
            scan_kwargs["ExclusiveStartKey"] = last_evaluated_key

        response = table.scan(**scan_kwargs)
        items = response.get("Items", [])

        for item in items:
            stats.scanned += 1

            if _is_valid_lat_lng(item.get("latitude"), item.get("longitude")):
                stats.already_present += 1
                continue

            raw_location = item.get("location")
            if not isinstance(raw_location, str) or not raw_location.strip():
                stats.skipped_no_location += 1
                continue

            inferred = _infer_coordinates(raw_location, use_fallback_center=use_fallback_center)
            if not inferred:
                stats.skipped_unresolved += 1
                continue

            stats.inferred += 1
            lat, lng = inferred

            if not apply_changes:
                continue

            try:
                table.update_item(
                    Key={"product_id": item["product_id"]},
                    UpdateExpression="SET latitude = :lat, longitude = :lng, updated_at = :updated_at",
                    ExpressionAttributeValues={
                        ":lat": Decimal(str(lat)),
                        ":lng": Decimal(str(lng)),
                        ":updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                stats.updated += 1
            except Exception:
                stats.failed += 1

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill missing product latitude/longitude from product location text.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates to DynamoDB. If omitted, runs as a dry-run preview.",
    )
    parser.add_argument(
        "--use-fallback-center",
        action="store_true",
        help="If location cannot be inferred, use Bangalore city-center coordinates as fallback.",
    )
    args = parser.parse_args()

    stats = run_backfill(apply_changes=args.apply, use_fallback_center=args.use_fallback_center)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"Mode: {mode}")
    print(f"Scanned: {stats.scanned}")
    print(f"Already had coords: {stats.already_present}")
    print(f"Could infer coords: {stats.inferred}")
    print(f"Updated: {stats.updated}")
    print(f"Skipped (missing location): {stats.skipped_no_location}")
    print(f"Skipped (unresolved location): {stats.skipped_unresolved}")
    print(f"Failed updates: {stats.failed}")


if __name__ == "__main__":
    main()
