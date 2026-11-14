"""Database tables (P3-02). Deliberately small: the bundles on disk stay the source of data.

Postgres holds only what must survive restarts and be queried: an index of every site the system
can serve (curated or custom), the custom site build history, and the data versions behind a
build. Time series and skylines stay in files (see lunar_engine.precompute).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# BIGINT on Postgres; plain INTEGER on SQLite, which only auto-increments that type (tests).
BigId = BigInteger().with_variant(Integer(), "sqlite")


class Base(DeclarativeBase):
    pass


class Site(Base):
    """One servable site. `kind` is curated or custom. `site_id` matches the folder name."""

    __tablename__ = "sites"

    site_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # "curated" | "custom"
    lat_deg: Mapped[float] = mapped_column(Float, nullable=False)
    lon_east_deg: Mapped[float] = mapped_column(Float, nullable=False)
    alt_m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    terrain_unavailable: Mapped[bool] = mapped_column(nullable=False, default=False)
    bytes_on_disk: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    built_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    jobs: Mapped[list[Job]] = relationship(back_populates="site", cascade="all, delete-orphan")
    versions: Mapped[list[DataVersion]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_sites_kind_last_requested", "kind", "last_requested_at"),)


class Job(Base):
    """A custom site build. One row per attempt, so failures stay visible."""

    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    site_id: Mapped[str] = mapped_column(
        ForeignKey("sites.site_id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    site: Mapped[Site] = relationship(back_populates="jobs")

    __table_args__ = (Index("ix_jobs_site_created", "site_id", "created_at"),)


class DataVersion(Base):
    """Which input files a site's numbers came from, so any figure can be reproduced."""

    __tablename__ = "data_versions"

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    site_id: Mapped[str] = mapped_column(
        ForeignKey("sites.site_id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[str] = mapped_column(String(32), nullable=False)  # ATTRIBUTION id
    detail: Mapped[str] = mapped_column(String(256), nullable=False)  # file name or API version
    sha256: Mapped[str | None] = mapped_column(String(64))
    site: Mapped[Site] = relationship(back_populates="versions")
