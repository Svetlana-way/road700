from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.application.review.queue import build_review_queue_response, execute_review_action_response
from app.application.review.rules import (
    create_review_rule_response,
    list_review_rules_response,
    update_review_rule_response,
)
from app.models.user import User
from app.schemas.review import (
    ReviewActionRequest,
    ReviewActionResponse,
    ReviewQueueResponse,
    ReviewRuleCreate,
    ReviewRuleListResponse,
    ReviewRuleRead,
    ReviewRuleUpdate,
)


router = APIRouter(prefix="/review", tags=["review"])


@router.get("/rules", response_model=ReviewRuleListResponse)
def list_review_rules(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ReviewRuleListResponse:
    _ = current_admin
    return list_review_rules_response(db)


@router.post("/rules", response_model=ReviewRuleRead)
def create_review_rule(
    payload: ReviewRuleCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ReviewRuleRead:
    _ = current_admin
    return create_review_rule_response(db, payload=payload)


@router.patch("/rules/{rule_id}", response_model=ReviewRuleRead)
def update_review_rule(
    rule_id: int,
    payload: ReviewRuleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ReviewRuleRead:
    _ = current_admin
    return update_review_rule_response(db, rule_id=rule_id, payload=payload)


@router.get("/queue", response_model=ReviewQueueResponse)
def get_review_queue(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewQueueResponse:
    return build_review_queue_response(
        db,
        current_user=current_user,
        limit=limit,
        offset=offset,
        category=category,
    )


@router.post("/queue/{document_id}/action", response_model=ReviewActionResponse)
def execute_review_action(
    document_id: int,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewActionResponse:
    return execute_review_action_response(
        db,
        current_user=current_user,
        document_id=document_id,
        action=payload.action.strip().lower(),
        comment=payload.comment,
    )
