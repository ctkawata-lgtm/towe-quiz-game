from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\OneDrive\ドキュメント\book\TAC2021_固定資産税過去問の本 v2.pdf")
reader = PdfReader(str(PDF))

print(f"pages={len(reader.pages)}")
for page_number, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    hits = []
    for pattern in [
        r"第\s*\d+\s*問",
        r"問\s*\d+",
        r"問題\s*\d+",
        r"解答",
        r"正解",
        r"解説",
        r"固定資産税",
    ]:
        if re.search(pattern, text):
            hits.append(pattern)
    if hits:
        preview = re.sub(r"\s+", " ", text[:420])
        print(f"--- PAGE {page_number} hits={','.join(hits)} ---")
        print(preview.encode("unicode_escape").decode("ascii"))
