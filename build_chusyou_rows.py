import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/chusyou_combined_text")
STRUCTURE = json.loads(Path("outputs/chusyou_structure.json").read_text(encoding="utf-8"))
OUT = Path("outputs/chusyou_rows.json")

YEARS = [
    ("R4", "令和4年度", 31, 7, 25, 129, 131, 148),
    ("R3", "令和3年度", 29, 29, 46, 149, 151, 167),
    ("R2", "令和2年度", 23, 49, 64, 169, 171, 187),
    ("R1", "令和元年度", 24, 67, 85, 191, 193, 209),
    ("H30", "平成30年度", 23, 89, 105, 211, 213, 228),
    ("H29", "平成29年度", 23, 109, 126, 231, 233, 251),
]

QUESTION_PAGE_OVERRIDES = {
    ("R3", 16): 37,
    ("R3", 17): 37,
    ("H30", 13): 97,
}

ANSWER_PAGE_OVERRIDES = {
    ("R4", 11): 137,
    ("R3", 13): 158,
    ("R2", 10): 178,
    ("H30", 10): 221,
}


def parse_summary(page_number: int) -> dict[int, list[dict[str, str]]]:
    lines = (TEXT_DIR / f"page_{page_number:03d}.txt").read_text(encoding="utf-8").splitlines()
    result: dict[int, list[dict[str, str]]] = {}
    current = None
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("問題 ") or line.startswith("合計") or line[0] in "令平中解":
            continue
        match = re.match(r"(\d+)\s*(?:－|-)?\s*(?:設問(\d+))?\s*([アイウエオ－-])", line)
        continuation = re.match(r"(?:設問(\d+))?\s*(?:－|-)?\s*([アイウエオ－-])", line)
        if match:
            current = int(match.group(1))
            sub = match.group(2)
            answer = match.group(3)
        elif current is not None and continuation:
            sub = continuation.group(1)
            answer = continuation.group(2)
        else:
            continue
        values = result.setdefault(current, [])
        label = f"設問{sub}" if sub else ("正解" if not values else f"設問{len(values) + 1}")
        values.append({"label": label, "answer": "確認" if answer in "－-" else answer})
        if len(values) > 1 and values[0]["label"] == "正解":
            values[0]["label"] = "設問1"
    return result


def build_page_map(items: list[dict], count: int, default_start: int, default_end: int) -> dict[int, int]:
    page_map = {}
    for item in items:
        number = item["number"]
        page = item["page"]
        if 1 <= number <= count:
            page_map.setdefault(number, page)
    previous = default_start
    for number in range(1, count + 1):
        if number in page_map:
            previous = page_map[number]
        else:
            page_map[number] = previous
    for number in range(count, 0, -1):
        page_map[number] = min(max(default_start, page_map[number]), default_end)
    return page_map


rows = []
for code, label, count, question_start, question_end, summary_page, answer_start, answer_end in YEARS:
    summary = parse_summary(summary_page)
    question_items = [item for item in STRUCTURE["questions"] if item["year"] == code]
    answer_items = [item for item in STRUCTURE["answers"] if item["year"] == code]
    question_pages = build_page_map(question_items, count, question_start, question_end)
    answer_pages = build_page_map(answer_items, count, answer_start, answer_end)
    for number in range(1, count + 1):
        question_pages[number] = QUESTION_PAGE_OVERRIDES.get((code, number), question_pages[number])
        answer_pages[number] = ANSWER_PAGE_OVERRIDES.get((code, number), answer_pages[number])
    for number in range(1, count + 1):
        next_question = question_pages.get(number + 1, question_end + 1)
        next_answer = answer_pages.get(number + 1, answer_end + 1)
        values = summary.get(number) or [{"label": "公式解答を確認", "answer": "確認"}]
        rows.append(
            {
                "id": f"{code}-{number:02d}",
                "year": label,
                "number": number,
                "values": values,
                "question_start": question_pages[number],
                "question_end": max(question_pages[number], next_question - 1),
                "answer_start": answer_pages[number],
                "answer_end": max(answer_pages[number], next_answer - 1),
            }
        )

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"rows={len(rows)}")
for row in rows[:5] + rows[-5:]:
    print(row)
