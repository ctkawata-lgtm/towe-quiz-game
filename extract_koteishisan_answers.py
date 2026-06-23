import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/koteishisan_ocr_text")
PAGE_MAP = json.loads(Path("outputs/koteishisan_page_map.json").read_text(encoding="utf-8"))
OUT = Path("outputs/koteishisan_answers_auto.json")
PRINTED_TO_PHYSICAL = {int(key): value for key, value in PAGE_MAP["printed_to_physical"].items()}

ANSWER_STARTS = [
    112, 116, 119, 121, 122, 123, 125, 127, 132, 138, 143, 146,
    149, 151, 153, 155, 156, 158, 160, 162, 166, 168, 172, 176,
    177, 180, 182, 184, 186, 188, 189, 192, 194, 198, 202, 207,
    212, 217, 222, 225, 229, 232, 234, 236, 239, 241, 243, 245,
]


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def money_values(summary: str) -> list[str]:
    values = re.findall(r"(\d[\d,\s]*?)\s*円", summary)
    result = []
    for value in values:
        normalized = re.sub(r"\s+", "", value)
        if normalized and normalized not in result:
            result.append(normalized)
    return result


rows = []
for problem, printed_page in enumerate(ANSWER_STARTS, start=1):
    physical = PRINTED_TO_PHYSICAL.get(printed_page)
    if physical is None:
        rows.append({"problem": problem, "printed": printed_page, "physical": None, "values": []})
        continue
    text = (TEXT_DIR / f"page_{physical:03d}.txt").read_text(encoding="utf-8")
    summary = re.split(r"計\s*算\s*過\s*程", text, maxsplit=1)[0]
    values = money_values(summary)
    rows.append(
        {
            "problem": problem,
            "printed": printed_page,
            "physical": physical,
            "values": values,
            "summary": compact(summary)[:260],
        }
    )

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
for row in rows:
    print(
        f"{row['problem']:02d} printed={row['printed']} "
        f"physical={row['physical']} values={row['values']} "
        f"summary={row.get('summary', '')}"
    )
