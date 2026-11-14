"""Table structure, constraints and cascades (SQLite stands in for Postgres here)."""

from datetime import UTC, datetime

import pytest
from lunar_api.models import Base, DataVersion, Job, Site
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

NOW = datetime(2026, 12, 1, tzinfo=UTC)


@pytest.fixture()
def engine():  # type: ignore[no-untyped-def]
    e = create_engine("sqlite://")
    # SQLite needs foreign keys switched on to enforce what Postgres enforces by default
    from sqlalchemy import event

    event.listen(e, "connect", lambda c, _r: c.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(e)
    return e


def _site(sid: str = "alpha", kind: str = "curated") -> Site:
    return Site(site_id=sid, kind=kind, lat_deg=-89.5, lon_east_deg=40.0, built_at=NOW)


def test_expected_tables_columns_and_indexes(engine) -> None:  # type: ignore[no-untyped-def]
    insp = inspect(engine)
    assert set(insp.get_table_names()) == {"sites", "jobs", "data_versions"}
    cols = {c["name"] for c in insp.get_columns("sites")}
    assert {"site_id", "kind", "lat_deg", "lon_east_deg", "terrain_unavailable", "built_at"} <= cols
    assert {i["name"] for i in insp.get_indexes("sites")} == {"ix_sites_kind_last_requested"}
    assert any(i["column_names"] == ["site_id", "created_at"] for i in insp.get_indexes("jobs"))
    pk = insp.get_pk_constraint("sites")["constrained_columns"]
    assert pk == ["site_id"]


def test_rows_round_trip_and_defaults(engine) -> None:  # type: ignore[no-untyped-def]
    with Session(engine) as s:
        s.add(_site())
        s.add(Job(job_id="job-1", site_id="alpha", status="done"))
        s.add(DataVersion(site_id="alpha", source_id="horizons", detail="API 1.2", sha256=None))
        s.commit()
        site = s.get(Site, "alpha")
        assert site is not None and site.alt_m == 0.0 and site.terrain_unavailable is False
        assert site.bytes_on_disk == 0 and site.last_requested_at is not None
        assert [j.job_id for j in site.jobs] == ["job-1"]
        assert s.scalar(select(DataVersion.detail)) == "API 1.2"


def test_a_job_or_version_needs_a_real_site(engine) -> None:  # type: ignore[no-untyped-def]
    with Session(engine) as s:
        s.add(Job(job_id="job-x", site_id="ghost", status="queued"))
        with pytest.raises(IntegrityError):
            s.commit()
    with Session(engine) as s:
        s.add(DataVersion(site_id="ghost", source_id="x", detail="y"))
        with pytest.raises(IntegrityError):
            s.commit()


def test_duplicate_ids_are_rejected_and_deleting_a_site_removes_its_history(engine) -> None:  # type: ignore[no-untyped-def]
    with Session(engine) as s:
        s.add_all(
            [
                _site(),
                Job(job_id="job-1", site_id="alpha", status="failed", reason="boom"),
                DataVersion(site_id="alpha", source_id="horizons", detail="d"),
            ]
        )
        s.commit()
    with Session(engine) as s:
        s.add(_site())
        with pytest.raises(IntegrityError):
            s.commit()
    with Session(engine) as s:
        s.delete(s.get(Site, "alpha"))
        s.commit()
        assert s.scalar(select(Job.job_id)) is None and s.scalar(select(DataVersion.id)) is None


def test_missing_required_fields_are_rejected(engine) -> None:  # type: ignore[no-untyped-def]
    with Session(engine) as s:
        s.add(Site(site_id="x", kind="curated", lat_deg=1.0, built_at=NOW))  # no longitude
        with pytest.raises(IntegrityError):
            s.commit()


def test_migration_files_form_one_linear_chain_and_match_the_models(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """Runs the real migration on SQLite and compares the result with the model metadata."""
    import os
    from pathlib import Path

    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.script import ScriptDirectory

    root = Path(__file__).resolve().parents[3]
    cfg = Config(str(root / "services" / "api" / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "services" / "api" / "migrations"))
    heads = ScriptDirectory.from_config(cfg).get_heads()
    assert heads == ["0001"], heads  # exactly one head: no branched history

    db = tmp_path / "m.sqlite"
    os.environ["DATABASE_URL"] = f"sqlite:///{db}"
    try:
        command.upgrade(cfg, "head")
        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.connect() as conn:
            drift = compare_metadata(MigrationContext.configure(conn), Base.metadata)
        assert drift == [], drift  # the models and the migration say the same thing
        command.downgrade(cfg, "base")
        assert set(inspect(create_engine(os.environ["DATABASE_URL"])).get_table_names()) == {
            "alembic_version"
        }
    finally:
        os.environ.pop("DATABASE_URL", None)
