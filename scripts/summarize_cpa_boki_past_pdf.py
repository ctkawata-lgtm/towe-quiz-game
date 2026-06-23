from pathlib import Path
import re
import sys

import pypdf


sys.stdout.reconfigure(encoding="utf-8")
PDF_PATH = Path(r"C:\Users\kawat\Downloads\26財務会計論（簿記）cpa、過去問.pdf")


def one_line(text: str, n: int = 260) -> str:
    return re.sub(r"\s+", " ", text).strip()[:n]


def main() -> None:
    reader = pypdf.PdfReader(str(PDF_PATH))
    for page_no, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if page_no <= 35 or "＜解" in text or "解 答" in text[:800] or "満 点" in text[:1000]:
            header = one_line(text, 300)
            print(f"{page_no:04d} len={len(text):4d} {header}")


if __name__ == "__main__":
    main()
