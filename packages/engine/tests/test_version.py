from lunar_engine import ENGINE_VERSION


def test_engine_version_is_semver_like() -> None:
    parts = ENGINE_VERSION.split(".")
    assert len(parts) == 3 and all(p.isdigit() for p in parts)
