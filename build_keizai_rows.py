import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/keizai_text")
OUT = Path("outputs/keizai_rows.json")

YEARS = [
    ("R4", "令和4年度", 21, 7, 20, 123, 125, 138),
    ("R3", "令和3年度", 23, 25, 38, 139, 141, 152),
    ("R2", "令和2年度", 23, 43, 58, 153, 155, 166),
    ("R1", "令和元年度", 21, 63, 76, 167, 169, 182),
    ("H30", "平成30年度", 21, 81, 96, 183, 185, 200),
    ("H29", "平成29年度", 23, 101, 120, 201, 203, 217),
]


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def parse_summary(page_number: int) -> dict[int, list[dict[str, str]]]:
    lines = (TEXT_DIR / f"page_{page_number:03d}.txt").read_text(encoding="utf-8").splitlines()
    result: dict[int, list[dict[str, str]]] = {}
    current = None
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("問題 ") or line.startswith("合計") or line[0] in "令平経解":
            continue
        match = re.match(r"(\d+)\s*(?:－|-)?\s*(?:設問(\d+))?\s*([アイウエオ])", line)
        continuation = re.match(r"(?:設問(\d+))?\s*(?:－|-)?\s*([アイウエオ])", line)
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
        values.append({"label": label, "answer": answer})
        if len(values) > 1 and values[0]["label"] == "正解":
            values[0]["label"] = "設問1"
    return result


def detect_pages(code: str, count: int, start: int, end: int, answer: bool) -> dict[int, int]:
    result = {}
    for page_number in range(start, end + 1):
        text = compact((TEXT_DIR / f"page_{page_number:03d}.txt").read_text(encoding="utf-8"))
        if not text.startswith(f"{code}経済"):
            continue
        if answer and "解答" not in text[:30]:
            continue
        if not answer and "解答" in text[:30]:
            continue
        for match in re.finditer(r"第(\d{1,2})問", text):
            number = int(match.group(1))
            if 1 <= number <= count:
                result.setdefault(number, page_number)
    previous = start
    for number in range(1, count + 1):
        if number in result:
            previous = result[number]
        else:
            result[number] = previous
    return result


rows = []
for code, label, count, question_start, question_end, summary_page, answer_start, answer_end in YEARS:
    summary = parse_summary(summary_page)
    question_pages = detect_pages(code, count, question_start, question_end, False)
    answer_pages = detect_pages(code, count, answer_start, answer_end, True)
    for number in range(1, count + 1):
        next_question = question_pages.get(number + 1, question_end + 1)
        next_answer = answer_pages.get(number + 1, answer_end + 1)
        rows.append(
            {
                "id": f"{code}-{number:02d}",
                "year": label,
                "number": number,
                "values": summary[number],
                "question_start": question_pages[number],
                "question_end": max(question_pages[number], next_question - 1),
                "answer_start": answer_pages[number],
                "answer_end": max(answer_pages[number], next_answer - 1),
            }
        )

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"rows={len(rows)} max_subquestions={max(len(row['values']) for row in rows)}")
for row in rows[:5] + rows[-5:]:
    print(row)
