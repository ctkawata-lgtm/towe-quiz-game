from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader


PDF_PATH = Path(r"C:\Users\kawat\Downloads\24_kakomonn_jouhou\24_kakomonn_jouhou.pdf")
OUT_PATH = Path("document_mode_rows.json")

QUESTION_RANGES = [
    ("R4", range(7, 21)),
    ("R3", range(23, 39)),
    ("R2", range(41, 55)),
    ("R1", range(57, 69)),
    ("H30", range(71, 83)),
    ("H29", range(85, 99)),
]

ANSWER_RANGES = [
    ("R4", range(103, 117)),
    ("R3", range(119, 135)),
    ("R2", range(137, 149)),
    ("R1", range(151, 163)),
    ("H30", range(165, 181)),
    ("H29", range(183, 199)),
]

LABEL_TO_NUMBER = {"ア": "1", "イ": "2", "ウ": "3", "エ": "4", "オ": "5"}


def extract_page(reader: PdfReader, page_number: int) -> str:
    return reader.pages[page_number - 1].extract_text() or ""


def meaningful_page(text: str) -> bool:
    stripped = re.sub(r"[\s.\d]", "", text)
    stripped = re.sub(r"(?:R[1-4]|H(?:29|30))情報(?:問|解答)", "", stripped)
    return bool(stripped)


def find_question_starts(reader: PdfReader, pages: range) -> dict[int, int]:
    starts: dict[int, int] = {}
    for page_number in pages:
        text = extract_page(reader, page_number)
        for match in re.finditer(r"第\s*(\d+)\s*問", text):
            starts.setdefault(int(match.group(1)), page_number)
    return starts


def find_answers(reader: PdfReader, pages: range) -> dict[int, dict[str, str | int]]:
    found: dict[int, dict[str, str | int]] = {}
    for page_number in pages:
        text = extract_page(reader, page_number)
        pattern = re.compile(r"第\s*(\d+)\s*問[^\n]*\n?\s*【解答】\s*([^\n]+)")
        for match in pattern.finditer(text):
            qnum = int(match.group(1))
            raw = re.sub(r"\s+", "", match.group(2))
            labels = [label for label in LABEL_TO_NUMBER if label in raw]
            if not labels:
                raise ValueError(f"Answer label was not found: page={page_number} q={qnum} raw={raw!r}")
            label_answer = "|".join(labels)
            number_answer = "|".join(LABEL_TO_NUMBER[label] for label in labels)
            found.setdefault(qnum, {
                "answer_page": page_number,
                "answer": label_answer,
                "alternatives": number_answer,
            })
    return found


def last_meaningful_page(reader: PdfReader, pages: range) -> int:
    result = pages.start
    for page_number in pages:
        if meaningful_page(extract_page(reader, page_number)):
            result = page_number
    return result


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    question_rows: list[dict[str, str]] = []
    page_rows: list[dict[str, str | int]] = []
    audit: list[str] = []

    for (year, question_pages), (answer_year, answer_pages) in zip(QUESTION_RANGES, ANSWER_RANGES):
        if year != answer_year:
            raise ValueError(f"Range mismatch: {year} != {answer_year}")
        starts = find_question_starts(reader, question_pages)
        answers = find_answers(reader, answer_pages)
        section_end = last_meaningful_page(reader, question_pages)
        qnums = sorted(starts)
        missing_answers = sorted(set(qnums) - set(answers))
        if missing_answers:
            raise ValueError(f"{year}: missing answer rows {missing_answers}")
        if len(qnums) != 25:
            audit.append(f"{year}: extracted {len(qnums)} questions instead of 25")

        for index, qnum in enumerate(qnums):
            start = starts[qnum]
            next_start = starts[qnums[index + 1]] if index + 1 < len(qnums) else section_end
            end = next_start if next_start == start else next_start - 1
            if index + 1 == len(qnums):
                end = section_end
            answer = answers[qnum]
            question_id = f"{year}-{qnum:02d}"
            question_rows.append({
                "問題番号": question_id,
                "正解": str(answer["answer"]),
                "別解": str(answer["alternatives"]),
            })
            page_rows.append({
                "問題番号": question_id,
                "問題開始ページ": start,
                "問題終了ページ": end,
                "解答ページ": int(answer["answer_page"]),
            })

    payload = {
        "source": str(PDF_PATH),
        "pdf_pages": len(reader.pages),
        "question_rows": question_rows,
        "page_rows": page_rows,
        "audit": audit,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"questions={len(question_rows)} pages={len(page_rows)} pdf_pages={len(reader.pages)} audit={len(audit)}")
    for message in audit:
        print(message)


if __name__ == "__main__":
    main()
