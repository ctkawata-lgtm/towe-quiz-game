import json
import re
from pathlib import Path


TEXT_DIR = Path("outputs/koteishisan_ocr_text")
OUT = Path("outputs/koteishisan_stage_candidates.json")


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def extract_numbers(text: str) -> list[str]:
    return re.findall(r"\d[\d,\s]*円", text[:700])


pages = []
for path in sorted(TEXT_DIR.glob("page_*.txt")):
    physical = int(path.stem.split("_")[1])
    text = path.read_text(encoding="utf-8")
    compacted = compact(text)
    problem_match = re.search(r"問題(\d{1,2})", compacted[:120])
    pages.append(
        {
            "physical": physical,
            "problem": int(problem_match.group(1)) if problem_match else None,
            "is_question": bool(problem_match and "制限時間" in compacted[:250]),
            "is_answer": bool(problem_match and "固定資産税額" in compacted[:250] and "制限時間" not in compacted[:250]),
            "numbers": extract_numbers(text),
            "preview": compacted[:240],
        }
    )

OUT.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
for page in pages:
    if page["is_question"] or page["is_answer"]:
        kind = "Q" if page["is_question"] else "A"
        print(f"{kind} physical={page['physical']:03d} problem={page['problem']:02d} numbers={page['numbers'][:6]}")
        print(page["preview"])
