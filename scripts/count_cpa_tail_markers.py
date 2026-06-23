from pathlib import Path
import logging
import re
import sys

import pypdf


sys.stdout.reconfigure(encoding="utf-8")
logging.getLogger("pypdf").setLevel(logging.ERROR)
PDF_PATH = Path(r"C:\Users\kawat\Downloads\財務会計論_簿記_cpa_過去問_最終.pdf")


def text(page) -> str:
    return page.extract_text() or ""


def main() -> None:
    reader = pypdf.PdfReader(str(PDF_PATH))
    q_pages = []
    answer_pages = []
    for page_no in range(720, len(reader.pages) + 1):
        t = text(reader.pages[page_no - 1])
        q_matches = re.findall(r"(?:【[^】]{0,50}?問題\s*\d{1,2}】|(?:^|\s)問題\s*\d{1,2}\s+重要度)", re.sub(r"\s+", " ", t))
        ans_matches = re.findall(r"正\s*解\s*[1-6１-６]", re.sub(r"\s+", "", t))
        if q_matches:
            q_pages.append((page_no, len(q_matches), q_matches[:5]))
        if ans_matches:
            answer_pages.append((page_no, len(ans_matches), ans_matches[:5]))
    print(f"question_pages={len(q_pages)} question_markers={sum(x[1] for x in q_pages)}")
    print(f"answer_pages={len(answer_pages)} answer_markers={sum(x[1] for x in answer_pages)}")
    print("question_samples")
    for item in q_pages[:20]:
        print(item)
    print("answer_samples")
    for item in answer_pages[:20]:
        print(item)
    print("last_question_samples")
    for item in q_pages[-20:]:
        print(item)


if __name__ == "__main__":
    main()
