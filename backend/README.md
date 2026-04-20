# LocalLoop Backend (FastAPI + AWS Cognito)

This backend starts with authentication using AWS Cognito.

## AWS setup for login and signup (Cognito)

1. Create an AWS account and choose one region (example: `ap-south-1`).
2. Open AWS Console -> Cognito -> User pools -> Create user pool.
3. User pool sign-in options:
   - Select `Email` (recommended for your app flow).
4. Configure security requirements:
   - Password policy: at least 8 chars, include uppercase/lowercase/number/symbol.
   - MFA: Optional for now (can enable later).
5. Configure sign-up experience:
   - Self-registration: enabled.
   - Required attributes: `email`.
   - Verification: `Send email message` for confirmation code.
6. Configure message delivery:
   - Use Cognito default email initially.
7. Integrate your app:
   - App type: `Traditional web app` or `Single-page application`.
   - App client name: for example `localloop-web-client`.
   - Generate client secret: keep disabled for SPA/frontend clients.
8. After creation, copy these values:
   - User pool ID (example `ap-south-1_AbCdEf123`)
   - App client ID
   - AWS region
9. In App client settings, enable auth flow:
   - `ALLOW_USER_PASSWORD_AUTH`.
10. Keep hosted UI optional for now because your API handles signup/login directly.

## 1) Setup Python environment

1. Open terminal in `backend` folder.
2. Create virtual environment:
   - Windows PowerShell: `python -m venv .venv`
3. Activate:
   - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
4. Install deps:
   - `pip install -r requirements.txt`

## 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Fill these values from AWS Cognito:
   - `AWS_REGION`
   - `COGNITO_USER_POOL_ID`
   - `COGNITO_APP_CLIENT_ID`
   - `COGNITO_APP_CLIENT_SECRET` (leave empty if client secret disabled)

Also configure AWS credentials on your machine so boto3 can call Cognito:

- Option A: `aws configure`
- Option B: environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

Minimum IAM permissions required for this phase:

- `cognito-idp:SignUp`
- `cognito-idp:ConfirmSignUp`
- `cognito-idp:InitiateAuth`

## 3) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

Base URL: `http://localhost:8000`

## 4) Auth endpoints

- POST `/api/v1/auth/signup`
- POST `/api/v1/auth/confirm-signup`
- POST `/api/v1/auth/login`
- GET `/api/v1/auth/me` (Bearer token)

## 5) End-to-end test flow

1. Call `POST /api/v1/auth/signup`.
2. Check email for Cognito verification code.
3. Call `POST /api/v1/auth/confirm-signup` with that code.
4. Call `POST /api/v1/auth/login` to receive `access_token` and `id_token`.
5. Call `GET /api/v1/auth/me` with header:
   - `Authorization: Bearer <access_token>`

## 6) Example request payloads

Signup:

```json
{
  "email": "alice@example.com",
  "password": "StrongPass123!",
  "name": "Alice"
}
```

Confirm signup:

```json
{
  "email": "alice@example.com",
  "confirmation_code": "123456"
}
```

Login:

```json
{
  "email": "alice@example.com",
  "password": "StrongPass123!"
}
```

## 7) DynamoDB setup (Users, Products, Chats, Offers)

Create these 4 DynamoDB tables in the same AWS region as your backend:

1. `LocalLoopUsers`
   - Partition key: `user_id` (String)
2. `LocalLoopProducts`
   - Partition key: `product_id` (String)
3. `LocalLoopChats`
   - Partition key: `message_id` (String)
4. `LocalLoopOffers`
   - Partition key: `offer_id` (String)

Recommended table settings for MVP:

- Billing mode: `On-demand`
- Point-in-time recovery: `Enabled`
- Encryption: `AWS owned key` (default is fine)

### AWS Console steps

1. Open AWS Console -> DynamoDB -> Tables -> Create table.
2. Enter table name and partition key for each table above.
3. Keep sort key empty for this phase.
4. Set table class to `Standard`.
5. Repeat until all 4 tables are created.

### Environment variables

Set these values in `.env` (or keep defaults from `.env.example`):

- `DYNAMODB_USERS_TABLE`
- `DYNAMODB_PRODUCTS_TABLE`
- `DYNAMODB_CHATS_TABLE`
- `DYNAMODB_OFFERS_TABLE`

### IAM permissions required

Add these DynamoDB actions to the IAM user/role used by backend:

- `dynamodb:PutItem`
- `dynamodb:GetItem`
- `dynamodb:Scan`
- `dynamodb:UpdateItem`

Limit resources to the 4 table ARNs for production.

## 8) New DynamoDB-backed endpoints

Users:

- `PUT /api/v1/users/me`
- `GET /api/v1/users/me`

Products:

- `POST /api/v1/products`
- `GET /api/v1/products`
- `GET /api/v1/products/{product_id}`

Chats:

- `POST /api/v1/chats/messages`
- `GET /api/v1/chats/messages?chat_id=<chat_id>`

Offers:

- `POST /api/v1/offers`
- `GET /api/v1/offers`

All endpoints above should be called with Cognito Bearer token where required.

## 9) S3 setup (Product Images)

This project uploads product images directly from frontend to S3 using backend-generated presigned URLs.

### AWS S3 steps

1. Open AWS Console -> S3 -> Create bucket.
2. Bucket name: for example `localloop-product-images`.
3. Region: same as backend (`AWS_REGION`).
4. Keep `Block all public access` enabled (recommended for secure setup).
5. Enable bucket versioning (recommended).
6. Create bucket.

### Add CORS on S3 bucket

Go to bucket -> Permissions -> CORS configuration and set:

```json
[
   {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"],
      "ExposeHeaders": ["ETag"]
   }
]
```

### Backend environment

Set these values in `.env`:

- `S3_BUCKET_NAME=localloop-product-images`
- `S3_PRESIGNED_EXPIRY_SECONDS=3600`

### IAM permissions for backend identity

Add these S3 actions on the bucket:

- `s3:PutObject`
- `s3:GetObject`

Scope resources to:

- `arn:aws:s3:::<your-bucket-name>`
- `arn:aws:s3:::<your-bucket-name>/*`

### New S3 endpoint

- `POST /api/v1/storage/presign-upload` (auth required)

Request body:

```json
{
   "file_name": "phone.jpg",
   "content_type": "image/jpeg"
}
```

Response includes:

- `upload_url`: presigned PUT URL
- `object_key`: store this in product `image_urls`

### Flow in app

1. Frontend asks backend for presigned upload URL.
2. Frontend uploads file directly to S3 using PUT.
3. Frontend creates product with uploaded `object_key` values.
4. Backend converts stored object keys to temporary presigned GET URLs when listing/fetching products.
