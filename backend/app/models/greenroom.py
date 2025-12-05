"""
Green Room Models - Project Development & Voting Arena
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from enum import Enum


class CycleStatus(str, Enum):
    """Voting cycle status"""
    UPCOMING = "upcoming"
    ACTIVE = "active"
    CLOSED = "closed"


class ProjectStatus(str, Enum):
    """Project submission status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PaymentStatus(str, Enum):
    """Payment processing status"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Cycle(SQLModel, table=True):
    """Voting cycle/period for Green Room projects"""
    __tablename__ = "greenroom_cycles"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    start_date: datetime = Field(index=True)
    end_date: datetime = Field(index=True)
    max_tickets_per_user: int = Field(default=100)
    ticket_price: float = Field(default=10.0)  # USD
    status: CycleStatus = Field(default=CycleStatus.UPCOMING, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    projects: list["Project"] = Relationship(back_populates="cycle")
    voting_tickets: list["VotingTicket"] = Relationship(back_populates="cycle")
    votes: list["Vote"] = Relationship(back_populates="cycle")


class Project(SQLModel, table=True):
    """Project submission in Green Room"""
    __tablename__ = "greenroom_projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    cycle_id: int = Field(foreign_key="greenroom_cycles.id", index=True)
    filmmaker_id: str = Field(index=True)  # FK to User.id

    # Project details
    title: str = Field(max_length=200)
    description: str
    category: Optional[str] = Field(default=None, max_length=100)
    video_url: Optional[str] = None
    image_url: Optional[str] = None

    # Status and voting
    status: ProjectStatus = Field(default=ProjectStatus.PENDING, index=True)
    vote_count: int = Field(default=0, index=True)  # Denormalized for performance

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None  # Admin user_id who approved

    # Relationships
    cycle: Cycle = Relationship(back_populates="projects")
    votes: list["Vote"] = Relationship(back_populates="project")


class VotingTicket(SQLModel, table=True):
    """User's voting ticket purchase for a cycle"""
    __tablename__ = "greenroom_voting_tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to User.id
    cycle_id: int = Field(foreign_key="greenroom_cycles.id", index=True)

    # Ticket counts
    tickets_purchased: int = Field(default=0)
    tickets_used: int = Field(default=0)

    # Payment details (Stripe integration)
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING, index=True)
    amount_paid: float = Field(default=0.0)  # Total amount in USD

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    cycle: Cycle = Relationship(back_populates="voting_tickets")

    @property
    def tickets_available(self) -> int:
        """Calculate available tickets"""
        return self.tickets_purchased - self.tickets_used


class Vote(SQLModel, table=True):
    """Vote allocation from user to project"""
    __tablename__ = "greenroom_votes"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to User.id
    project_id: int = Field(foreign_key="greenroom_projects.id", index=True)
    cycle_id: int = Field(foreign_key="greenroom_cycles.id", index=True)

    # Vote details
    tickets_allocated: int = Field(gt=0)  # Must be at least 1 ticket

    # Metadata (votes are final, no updates)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Relationships
    project: Project = Relationship(back_populates="votes")
    cycle: Cycle = Relationship(back_populates="votes")

    class Config:
        # Ensure unique constraint: one vote per user per project
        table_args = {
            "unique_constraints": [("user_id", "project_id", "cycle_id")]
        }
