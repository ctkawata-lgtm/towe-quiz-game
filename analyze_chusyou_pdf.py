import re
from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\Downloads\24_kakomonn_chusyou\24_kakomonn_chusyou.pdf")
OCR_DIR = Path("outputs/chusyou_ocr_text")
OUT_DIR = Path("outputs/chusyou_combined_text")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


reader = PdfReader(str(PDF))
for page_number, page in enumerate(reader.pages, start=1):
    extracted = page.extract_text() or ""
    ocr_path = OCR_DIR / f"page_{page_number:03d}.txt"
    ocr = ocr_path.read_text(encoding="utf-8") if ocr_path.exists() else ""
    text = extracted if len(compact(extracted)) >= len(compact(ocr)) else ocr
    (OUT_DIR / f"page_{page_number:03d}.txt").write_text(text, encoding="utf-8")

    merged = compact(text)
    signals = []
    for pattern in [
        r"目次",
        r"問題\d+",
        r"第\d+問",
        r"解答",
        r"正解",
        r"解説",
        r"中小企業診断士",
    ]:
        if re.search(pattern, merged):
            signals.append(pattern)
    if signals:
        preview = merged[:180].encode("unicode_escape").decode("ascii")
        print(f"page={page_number:03d} chars={len(merged)} signals={','.join(signals)}")
        print(preview)
