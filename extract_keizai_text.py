from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\Downloads\24_kakomonn_keizai\24_kakomonn_keizai.pdf")
OUT = Path("outputs/keizai_text")
OUT.mkdir(parents=True, exist_ok=True)

reader = PdfReader(str(PDF))
for page_number, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    (OUT / f"page_{page_number:03d}.txt").write_text(text, encoding="utf-8")
print(f"pages={len(reader.pages)}")
