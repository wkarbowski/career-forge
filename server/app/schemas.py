from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Any
from datetime import datetime
import re


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username contains only safe characters."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password meets security requirements.
        
        Requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one number
        - At least one special character
        """
        errors = []
        
        if len(v) < 8:
            errors.append('at least 8 characters')
        if not re.search(r'[A-Z]', v):
            errors.append('one uppercase letter')
        if not re.search(r'[a-z]', v):
            errors.append('one lowercase letter')
        if not re.search(r'[0-9]', v):
            errors.append('one number')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]', v):
            errors.append('one special character (!@#$%^&*...)')
        
        if errors:
            raise ValueError(f'Password must contain {", ".join(errors)}')
        
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    theme: str = "dark"
    language: str = "en"
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None


class UserPreferences(BaseModel):
    theme: Optional[str] = Field(None, pattern="^(dark|light)$")
    language: Optional[str] = Field(None, min_length=2, max_length=10)


class Token(BaseModel):
    """Legacy token response (access token only)."""
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    """Token response with both access and refresh tokens (for clients that handle cookies)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Access token expiration in seconds


class AccessTokenResponse(BaseModel):
    """
    Token response for HttpOnly cookie-based auth.
    Refresh token is sent as HttpOnly cookie, not in response body.
    """
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # Access token expiration in seconds


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh (fallback for clients not using cookies)."""
    refresh_token: Optional[str] = None  # Optional - can use cookie instead


class TokenData(BaseModel):
    user_id: Optional[int] = None


class DocumentBase(BaseModel):
    title: str = Field(default="My CV", max_length=255)
    document_type: str = Field(default="resume", pattern="^(resume|cover_letter)$")


class DocumentCreate(DocumentBase):
    data: Any  # JSON content for the document


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    document_type: Optional[str] = Field(None, pattern="^(resume|cover_letter)$")
    data: Optional[Any] = None
    is_default: Optional[bool] = None


class DocumentResponse(DocumentBase):
    id: int
    data: Any
    owner_id: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(DocumentBase):
    id: int
    owner_id: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Export/Import Schemas ==============

class DocumentExport(BaseModel):
    """Schema for exporting document data."""
    title: str
    document_type: str = "resume"
    data: Any
    exported_at: datetime


class DocumentImport(BaseModel):
    """Schema for importing document data."""
    title: Optional[str] = "Imported CV"
    document_type: str = Field(default="resume", pattern="^(resume|cover_letter)$")
    data: Any
