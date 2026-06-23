from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\OneDrive\ドキュメント\book\TAC2021_固定資産税過去問の本 v2.pdf")
OUT = Path("outputs/koteishisan_ocr_images")
OUT.mkdir(parents=True, exist_ok=True)

reader = PdfReader(str(PDF))
for page_number, page in enumerate(reader.pages, start=1):
    image = page.images[0]
    suffix = Path(image.name).suffix or ".jpg"
    target = OUT / f"page_{page_number:03d}{suffix}"
    if not target.exists():
        target.write_bytes(image.data)
    if page_number % 25 == 0 or page_number == len(reader.pages):
        print(f"extracted={page_number}/{len(reader.pages)}")
