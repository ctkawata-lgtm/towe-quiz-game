from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\Downloads\24_kakomonn_chusyou\24_kakomonn_chusyou.pdf")
OUT = Path("outputs/chusyou_ocr_images")
OUT.mkdir(parents=True, exist_ok=True)

reader = PdfReader(str(PDF))
for page_number, page in enumerate(reader.pages, start=1):
    images = page.images
    if not images:
        continue
    image = max(images, key=lambda item: len(item.data))
    suffix = Path(image.name).suffix or ".jpg"
    target = OUT / f"page_{page_number:03d}{suffix}"
    if not target.exists():
        target.write_bytes(image.data)
    if page_number % 25 == 0 or page_number == len(reader.pages):
        print(f"extracted={page_number}/{len(reader.pages)}")
