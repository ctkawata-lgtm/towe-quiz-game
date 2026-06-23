from pathlib import Path

from pypdf import PdfReader


PDF = Path(r"C:\Users\kawat\OneDrive\ドキュメント\book\TAC2021_固定資産税過去問の本 v2.pdf")
OUT = Path("outputs/koteishisan_samples")
OUT.mkdir(parents=True, exist_ok=True)

reader = PdfReader(str(PDF))
samples = [1, 2, 3, 4, 5, 10, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 296]
for page_number in samples:
    image = reader.pages[page_number - 1].images[0]
    suffix = Path(image.name).suffix or ".png"
    target = OUT / f"page_{page_number:03d}{suffix}"
    target.write_bytes(image.data)
    print(target)
