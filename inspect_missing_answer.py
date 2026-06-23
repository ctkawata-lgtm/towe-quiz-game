from pathlib import Path
from pypdf import PdfReader

reader = PdfReader(str(Path(r"C:\Users\kawat\Downloads\24_kakomonn_jouhou\24_kakomonn_jouhou.pdf")))
for page_number in range(109, 114):
    text = reader.pages[page_number - 1].extract_text() or ""
    print(f"--- PAGE {page_number} ---")
    print(text.encode("unicode_escape").decode("ascii"))
