from pathlib import Path
import logging
import re
import sys

import pypdf


sys.stdout.reconfigure(encoding="utf-8")
logging.getLogger("pypdf").setLevel(logging.ERROR)

PDF_PATH = Path(r"C:\Users\kawat\Downloads\財務会計論_簿記_cpa_過去問_最終.pdf")


def main() -> None:
    reader = pypdf.PdfReader(str(PDF_PATH))
    print(f"pages={len(reader.pages)}")
    for page_no in [1, 2, 3, 10, 20, 30, 40, 50, 80, 100, 120, 150, 200, 250, 300, 350, 400, 450, 500]:
        if page_no > len(reader.pages):
            continue
        text = reader.pages[page_no - 1].extract_text() or ""
        print(f"---PAGE {page_no} len={len(text)}")
        print(re.sub(r"\s+", " ", text[:1200]))


if __name__ == "__main__":
    main()
