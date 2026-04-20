from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import (
    AuthTokensResponse,
    ConfirmSignUpRequest,
    CurrentUserResponse,
    LoginRequest,
    MessageResponse,
    SignUpRequest,
)
from app.services.cognito_service import CognitoService, parse_cognito_error

router = APIRouter(prefix="/auth", tags=["auth"])
cognito_service = CognitoService()


@router.post("/signup", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignUpRequest) -> MessageResponse:
    try:
        cognito_service.sign_up(email=payload.email, password=payload.password, name=payload.name)
        return MessageResponse(message="Signup successful. Check your email for confirmation code.")
    except ClientError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parse_cognito_error(exc)) from exc


@router.post("/confirm-signup", response_model=MessageResponse)
def confirm_signup(payload: ConfirmSignUpRequest) -> MessageResponse:
    try:
        cognito_service.confirm_sign_up(
            email=payload.email,
            confirmation_code=payload.confirmation_code,
        )
        return MessageResponse(message="Email confirmed. You can login now.")
    except ClientError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=parse_cognito_error(exc)) from exc


@router.post("/login", response_model=AuthTokensResponse)
def login(payload: LoginRequest) -> AuthTokensResponse:
    try:
        response = cognito_service.login(email=payload.email, password=payload.password)
        auth_result = response.get("AuthenticationResult", {})
        return AuthTokensResponse(
            access_token=auth_result.get("AccessToken", ""),
            id_token=auth_result.get("IdToken", ""),
            refresh_token=auth_result.get("RefreshToken"),
            expires_in=auth_result.get("ExpiresIn", 0),
            token_type=auth_result.get("TokenType", "Bearer"),
        )
    except ClientError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=parse_cognito_error(exc)) from exc


@router.get("/me", response_model=CurrentUserResponse)
async def me(current_user: dict = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        sub=current_user.get("sub", ""),
        email=current_user.get("email"),
        username=current_user.get("username"),
    )
