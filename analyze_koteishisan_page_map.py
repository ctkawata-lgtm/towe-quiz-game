import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/koteishisan_ocr_text")
OUT = Path("outputs/koteishisan_page_map.json")


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def find_printed_page(text: str) -> int | None:
    matches = re.findall(r"[ー\-]\s*(\d{1,3})\s*[ー\-]", text)
    return int(matches[-1]) if matches else None


pages = []
for path in sorted(TEXT_DIR.glob("page_*.txt")):
    physical = int(path.stem.split("_")[1])
    text = path.read_text(encoding="utf-8")
    compacted = compact(text)
    printed = find_printed_page(text)
    answer_match = re.search(r"解(?:答)?問題(\d{1,2})", compacted)
    question_match = re.search(r"問題(\d{1,2})", compacted)
    pages.append(
        {
            "physical": physical,
            "printed": printed,
            "answer_problem": int(answer_match.group(1)) if answer_match else None,
            "question_problem": int(question_match.group(1)) if question_match else None,
            "preview": compacted[:160],
        }
    )

printed_to_physical = {
    str(page["printed"]): page["physical"]
    for page in pages
    if page["printed"] is not None
}
payload = {"pages": pages, "printed_to_physical": printed_to_physical}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"pages={len(pages)} mapped={len(printed_to_physical)}")
for printed in [4, 44, 81, 112, 116, 184, 245, 250, 288]:
    print(f"printed={printed} physical={printed_to_physical.get(str(printed))}")
print("answer headers:")
for page in pages:
    if page["answer_problem"] is not None:
        print(
            f"problem={page['answer_problem']:02d} "
            f"printed={page['printed']} physical={page['physical']}"
        )
