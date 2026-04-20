from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr

from app.core.config import get_settings


def get_dynamodb_resource() -> Any:
    settings = get_settings()
    return boto3.resource("dynamodb", region_name=settings.aws_region)


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
