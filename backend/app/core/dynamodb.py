from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr

from app.core.config import get_settings


def get_dynamodb_resource() -> Any:
    get_settings.cache_clear()
    settings = get_settings()
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            kwargs["aws_session_token"] = settings.aws_session_token

    return boto3.resource("dynamodb", **kwargs)


def get_table(table_name: str):
    resource = get_dynamodb_resource()
    return resource.Table(table_name)


def to_decimal(value: float | int) -> Decimal:
    return Decimal(str(value))


def serialize_dynamo(value: Any) -> Any:
    if isinstance(value, list):
        return [serialize_dynamo(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_dynamo(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    return value


def scan_with_optional_filter(table, filters: dict[str, Any]):
    filter_expression = None
    for field_name, field_value in filters.items():
        if field_value is None:
            continue
        condition = Attr(field_name).eq(field_value)
        filter_expression = condition if filter_expression is None else filter_expression & condition

    if filter_expression is None:
        return table.scan()
    return table.scan(FilterExpression=filter_expression)
