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
