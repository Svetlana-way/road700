from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole, VehicleType


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    login: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserAssignmentVehicleRead(BaseModel):
    id: int
    vehicle_type: VehicleType
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]


class UserVehicleAssignmentRead(BaseModel):
    id: int
    vehicle_id: int
    starts_at: date
    ends_at: Optional[date]
    comment: Optional[str]
    vehicle: UserAssignmentVehicleRead


class UserDetailRead(UserRead):
    assignments: list[UserVehicleAssignmentRead]


class UserListResponse(BaseModel):
    items: list[UserDetailRead]
    total: int


class UserCreateRequest(BaseModel):
    full_name: str
    login: str
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True
    password: str


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    login: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserAssignmentCreateRequest(BaseModel):
    vehicle_id: int
    starts_at: Optional[date] = None
    ends_at: Optional[date] = None
    comment: Optional[str] = None


class UserAssignmentUpdateRequest(BaseModel):
    starts_at: Optional[date] = None
    ends_at: Optional[date] = None
    comment: Optional[str] = None


class UserResetPasswordRequest(BaseModel):
    new_password: str
