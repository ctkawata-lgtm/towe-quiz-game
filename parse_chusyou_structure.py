import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/chusyou_combined_text")
OUT = Path("outputs/chusyou_structure.json")

YEAR_LABELS = {
    "R4": "令和4年度",
    "R3": "令和3年度",
    "R2": "令和2年度",
    "R1": "令和元年度",
    "H30": "平成30年度",
    "H29": "平成29年度",
}


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def get_year(text: str) -> str | None:
    match = re.search(r"(R4|R3|R2|R1|H30|H29)中[小⼩]", text)
    return match.group(1) if match else None


pages = []
for path in sorted(TEXT_DIR.glob("page_*.txt")):
    physical = int(path.stem.split("_")[1])
    text = compact(path.read_text(encoding="utf-8"))
    pages.append({"physical": physical, "text": text, "year": get_year(text)})

questions = []
answers = []
for page in pages:
    year = page["year"]
    if not year:
        continue
    text = page["text"]
    if "解答" not in text[:20]:
        for number in re.findall(r"第(\d{1,2})問", text):
            questions.append({"year": year, "number": int(number), "page": page["physical"]})
    if "解答" in text[:20]:
        for match in re.finditer(r"第(\d{1,2})問【解答】(.*?)(?=【解説】|第\d{1,2}問【解答】|$)", text):
            number = int(match.group(1))
            raw = match.group(2)
            sub_matches = re.findall(r"（設問(\d+)）([ア-オ])", raw)
            if sub_matches:
                values = [{"label": f"設問{sub}", "answer": answer} for sub, answer in sub_matches]
            else:
                simple = re.search(r"([ア-オ])", raw)
                values = [{"label": "正解", "answer": simple.group(1)}] if simple else []
            answers.append({"year": year, "number": number, "page": page["physical"], "values": values, "raw": raw})

payload = {"questions": questions, "answers": answers}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

for year in YEAR_LABELS:
    qs = sorted({item["number"] for item in questions if item["year"] == year})
    ans = sorted({item["number"] for item in answers if item["year"] == year})
    print(f"{year} questions={len(qs)} {qs[:3]}..{qs[-3:] if qs else []} answers={len(ans)}")
print("answers_sample=", answers[:8])
