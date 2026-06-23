from __future__ import annotations

import re
from pathlib import Path


OCR = Path("outputs/koteishisan_ocr_text")

patterns = [
    r"基\s*礎\s*問\s*題",
    r"応\s*用\s*問\s*題",
    r"本\s*試\s*験\s*問\s*題",
    r"解\s*答\s*へ\s*の\s*道",
    r"第\s*[0-9０-９]+\s*問",
    r"問\s*[0-9０-９]+",
    r"第\s*[0-9０-９]+\s*回",
]

for file in sorted(OCR.glob("page_*.txt")):
    page = int(file.stem.split("_")[1])
    text = file.read_text(encoding="utf-8-sig")
    compact = re.sub(r"\s+", "", text)
    hits = []
    for pattern in patterns:
        found = re.findall(pattern, text)
        if found:
            hits.extend(found[:3])
        found_compact = re.findall(pattern.replace(r"\s*", ""), compact)
        if found_compact:
            hits.extend(found_compact[:3])
    if hits:
        clean_hits = []
        for hit in hits:
            value = re.sub(r"\s+", "", hit)
            if value not in clean_hits:
                clean_hits.append(value)
        print(f"{page:03d}: {' | '.join(clean_hits)}")
