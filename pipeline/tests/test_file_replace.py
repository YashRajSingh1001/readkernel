import json
from pathlib import Path

import pytest

from kernel.store import load_recent_stories, save_files

DATE = "2026-11-15"


@pytest.mark.parametrize("phase", ["write", "rename"])
@pytest.mark.parametrize("file_number", [1, 2])
def test_interruption_preserves_each_complete_file(tmp_path, monkeypatch, phase, file_number):
    old = {"date": DATE, "stories": ["old"]}
    new = {"date": DATE, "stories": ["new"]}
    save_files(old, tmp_path)
    calls = 0
    original = Path.write_text if phase == "write" else Path.replace

    def interrupted(self, *args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == file_number:
            if phase == "write":
                original(self, '{"truncated":', **kwargs)
            raise OSError("disk full")
        return original(self, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text" if phase == "write" else "replace", interrupted)
    with pytest.raises(OSError):
        save_files(new, tmp_path)
    assert json.loads((tmp_path / "latest.json").read_text()) == old
    expected_dated = old if file_number == 1 else new
    assert json.loads((tmp_path / f"brief-{DATE}.json").read_text()) == expected_dated
    assert not list(tmp_path.glob(".*.tmp"))


def test_incomplete_temp_files_are_ignored_by_local_history(tmp_path):
    save_files({"date": DATE, "stories": [{"headline": "old"}]}, tmp_path)
    (tmp_path / f".brief-{DATE}.json.abcd.tmp").write_text('{"incomplete":')
    assert load_recent_stories(None, tmp_path, "2026-11-16")[0]["headline"] == "old"
