from pathlib import Path
import sys

import pypdf


PDF_PATH = Path(r"C:\Users\kawat\Downloads\26財務会計論（簿記）cpa、過去問.pdf")
sys.stdout.reconfigure(encoding="utf-8")


def main() -> None:
    reader = pypdf.PdfReader(str(PDF_PATH))
    print(f"pages={len(reader.pages)}")
    sample_pages = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140]
    for page_no in sample_pages:
        if page_no > len(reader.pages):
            continue
        text = reader.pages[page_no - 1].extract_text() or ""
        print(f"---PAGE {page_no} len={len(text)}")
        print(text[:1200].replace("\n", " "))


if __name__ == "__main__":
    main()
