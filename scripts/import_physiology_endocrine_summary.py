#!/usr/bin/env python3
"""Import the approved endocrine matching questions without changing the base bank."""

from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import string
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "physiology/endocrine-summary-reviewed.json"
OUTPUT = ROOT / "src/data/physiology-endocrine-summary-data.json"
IMAGE_DIR = ROOT / "public/physiology/lecture-pages"
SOURCE_KEY = "physiology-endocrine-summary-2026-10"
SHUFFLE_VERSION = 1


def shuffle_options(group: dict) -> None:
    """Stable Sattolo shuffle: move every option, then remap answers by identity."""
    options = group["options"]
    assert 1 < len(options) <= len(string.ascii_uppercase)
    original = deepcopy(options)
    # One deterministic cycle has no fixed positions. Never reshuffle on reload.
    for index in range(len(options) - 1, 0, -1):
        digest = hashlib.sha256(f"endocrine-options-v{SHUFFLE_VERSION}:{group['id']}:{index}".encode()).digest()
        other = int.from_bytes(digest, "big") % index
        options[index], options[other] = options[other], options[index]
    key_map = {}
    for index, option in enumerate(options):
        old_key = option["key"]
        new_key = string.ascii_uppercase[index]
        key_map[old_key] = new_key
        option["originalKey"] = old_key
        option["key"] = new_key
        assert option["label"] != original[index]["label"]
    for stem in group["stems"]:
        stem["answer"] = sorted(key_map[key] for key in stem["answer"])
        stem["answerRaw"] = "".join(stem["answer"])
    group["optionShuffleVersion"] = SHUFFLE_VERSION
    # Existing UI versions only answers; bookmarks and notes continue using group.id.
    group["answerRevision"] = f"options-shuffle-v{SHUFFLE_VERSION}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lecture-pdf", type=Path)
    parser.add_argument("--render-pages", action="store_true")
    args = parser.parse_args()
    reviewed = json.loads(REVIEW.read_text(encoding="utf-8"))
    base = json.loads((ROOT / "src/data/physiology-data.json").read_text(encoding="utf-8"))
    lecture = next(item for item in base["lectures"] if item["id"] == "lecture-40")
    assert reviewed["meta"]["sourceSha256"] == lecture["sourceSha256"]
    assert len(reviewed["groups"]) == 11
    assert sum(len(group["stems"]) for group in reviewed["groups"]) == 70

    if args.lecture_pdf:
        assert hashlib.sha256(args.lecture_pdf.read_bytes()).hexdigest() == lecture["sourceSha256"]
    if args.render_pages:
        if not args.lecture_pdf:
            parser.error("--render-pages requires --lecture-pdf")
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="endocrine-lecture-") as tmp:
            prefix = Path(tmp) / "page"
            subprocess.run([
                "pdftoppm", "-f", "4", "-l", "6", "-scale-to", "2000", "-png",
                str(args.lecture_pdf), str(prefix),
            ], check=True)
            for page in [4, 5, 6]:
                with Image.open(Path(tmp) / f"page-{page}.png") as image:
                    image.convert("RGB").save(IMAGE_DIR / f"lecture-40-page-{page:02d}.webp", quality=90, method=6)

    pages = [{
        "page": number,
        "sourceKey": SOURCE_KEY,
        "image": f"physiology/lecture-pages/lecture-40-page-{number:02d}.webp",
        "topic": "内分泌",
    } for number in [4, 5, 6]]
    for page in pages:
        assert (ROOT / "public" / page["image"]).is_file(), page["image"]

    groups = deepcopy(reviewed["groups"])
    for group in groups:
        shuffle_options(group)
        number = group["groupNumber"]
        primary_page = group["sourcePages"][-1]
        group.update({
            "title": f"内分泌小结 · 第{number}组 · {group['title']}",
            "page": group["sourcePages"][0],
            "sourceKey": SOURCE_KEY,
            "sourceName": reviewed["meta"]["sourceName"],
            "sourceLabel": "内分泌小结补充题",
            "kindLabel": "内分泌小结补充题",
            "hideSource": True,
            "answerLayout": "rows",
            "answerSourceLabel": "参考答案",
            "studyNotice": "第40讲第4–6页改编 · 选项已固定打乱，每个小问独立作答。",
            "reviewState": "用户审阅后确认导入",
            "lectureEvidence": {
                "lectureId": "lecture-40",
                "lectureNumber": 40,
                "lectureTitle": lecture["title"],
                "page": primary_page,
                "pageLabel": "对应第 " + "、".join(map(str, group["sourcePages"])) + " 页",
                "title": f"第40讲第{primary_page}页：内分泌小结",
                "image": f"physiology/lecture-pages/lecture-40-page-{primary_page:02d}.webp",
                "method": "2027讲义小结改编，用户确认精简合并版后导入",
            },
        })
        # Existing UI displays this only after submitting; keep the bank uncluttered.
        group["stems"][0]["explanation"] = group["explanation"]
        group["stems"][0]["lectureId"] = "lecture-40"
        for stem in group["stems"]:
            assert stem["answer"] == list(stem["answerRaw"])
            assert set(stem["answer"]) <= {option["key"] for option in group["options"]}
            assert "本讲义" not in stem["text"]
        del group["originalGroupNumbers"]

    payload = {
        "meta": {
            "title": "内分泌小结补充题",
            "sourceName": reviewed["meta"]["sourceName"],
            "sourceSha256": reviewed["meta"]["sourceSha256"],
            "sourcePages": [4, 5, 6],
            "lectureId": "lecture-40",
            "groupCount": 11,
            "stemCount": 70,
            "siteIntegrated": True,
            "reviewedRevision": 2,
            "optionShuffleVersion": SHUFFLE_VERSION,
            "shuffleMode": "按题组固定打乱，选项重新编号，答案同步重映射",
            "answerNote": "依据2027讲义自编；用户确认的11组70问精简合并版，非原学成资料或阶段考试原题。",
            "generatedBy": "scripts/import_physiology_endocrine_summary.py",
        },
        "groups": groups,
        "pages": pages,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"groups": 11, "stems": 70, "pages": [4, 5, 6], "lectureId": "lecture-40", "status": "ok"}))


if __name__ == "__main__":
    main()
