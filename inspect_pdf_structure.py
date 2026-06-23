from pathlib import Path
from pypdf import PdfReader

PDF = Path(r"C:\Users\kawat\Downloads\24_kakomonn_jouhou\24_kakomonn_jouhou.pdf")


def preview(text: str, limit: int = 720) -> str:
    return (text or "")[:limit].encode("unicode_escape").decode("ascii")


reader = PdfReader(str(PDF))
for page_number in [7, 8, 19, 20, 103, 104, 115, 116, 119, 120, 183, 184, 197, 198]:
    text = reader.pages[page_number - 1].extract_text() or ""
    print(f"--- PAGE {page_number} ---")
    print(preview(text))
