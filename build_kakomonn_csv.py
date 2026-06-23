from __future__ import annotations

import csv
import re
from pathlib import Path

from pypdf import PdfReader


PDF_PATH = Path(r"C:\Users\kawat\Downloads\24_kakomonn_jouhou\24_kakomonn_jouhou.pdf")
OUT_PATH = Path("24_kakomonn_jouhou_quiz.csv")

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

CHOICE_LABELS = "アイウエオ"
LABEL_TO_NUM = {label: str(i + 1) for i, label in enumerate(CHOICE_LABELS)}
FIGURE_HINTS = [
    "下図", "次の図", "以下の図", "図に", "図の", "図示", "グラフ",
    "下表", "次の表", "以下の表", "表に示", "画面", "ER図", "DFD",
    "プログラム", "フローチャート",
]


def clean_text(text: str) -> str:
    text = text.replace("\u2003", " ").replace("\u3000", " ")
    text = text.replace(" ", " ").replace("　", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[0-9]{1,3}\n", "\n", text)
    text = re.sub(r"\n(?:R[1-4]|H2[9]|H30|令和2年)情報 (?:問|解答)\.?\n", "\n", text)
    text = re.sub(r"\n\.\n", "\n", text)
    return text.strip()


def read_pages(reader: PdfReader, pages: range) -> str:
    return clean_text("\n".join(reader.pages[i - 1].extract_text() or "" for i in pages))


def normalize_answer(answer: str) -> str:
    answer = answer.strip().replace(" ", "")
    nums = [LABEL_TO_NUM[ch] for ch in CHOICE_LABELS if ch in answer]
    if nums:
      return "|".join(nums)
    return ""


def split_question_blocks(text: str) -> dict[int, str]:
    blocks: dict[int, str] = {}
    pattern = re.compile(r"第(\d+)問\s*(.*?)(?=\n第\d+問\s*|\Z)", re.S)
    for m in pattern.finditer(text):
        blocks[int(m.group(1))] = m.group(2).strip()
    return blocks


def split_answer_blocks(text: str) -> dict[int, dict[str, str]]:
    blocks: dict[int, dict[str, str]] = {}
    pattern = re.compile(
        r"第(\d+)問\s*【解答】\s*(.*?)\n【解説】\s*(.*?)(?=\n\s*第\d+問\s*【解答】|\Z)",
        re.S,
    )
    for m in pattern.finditer(text):
        qnum = int(m.group(1))
        answer = normalize_answer(m.group(2))
        explanation = cleanup_body(m.group(3))
        blocks[qnum] = {
            "answer": answer,
            "explanation": explanation,
            **choice_explanations(explanation),
        }
    return blocks


def cleanup_body(text: str) -> str:
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_choices(block: str) -> tuple[str, list[str]]:
    block = re.sub(r"〔解答群〕", "\n", block)
    matches = list(re.finditer(r"(?:^|\n)\s*([アイウエオ])\s+", block))
    if len(matches) < 4:
        return cleanup_body(block), []

    first = matches[0].start()
    question = cleanup_body(block[:first])
    choices: list[str] = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        choices.append(cleanup_body(block[start:end]))
    return question, choices[:5]


def choice_explanations(explanation: str) -> dict[str, str]:
    result = {f"choice_exp_{i}": "" for i in range(1, 6)}
    matches = list(re.finditer(r"(?:^| )([アイウエオ])\s+(適切|不適切|正しい|誤り|該当|非該当|本選択肢)", explanation))
    if len(matches) < 2:
        return result

    for i, m in enumerate(matches):
        label = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(explanation)
        num = LABEL_TO_NUM[label]
        result[f"choice_exp_{num}"] = cleanup_body(explanation[start:end])
    return result


def should_skip(question: str, choices: list[str], answer: str, explanation: str) -> str:
    if not answer:
        return "正解を抽出できない"
    if len(choices) < 4:
        return "選択肢を抽出できない"
    if len(choices) > 5:
        return "選択肢が5個を超える"
    if any(hint in question for hint in FIGURE_HINTS):
        return "図表・画面・プログラム依存"
    if len(question) > 1800:
        return "問題文が長く図表依存の可能性が高い"
    if "当初" in answer or "全員正解" in explanation[:120]:
        return "全員正解・訂正問題"
    return ""


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    rows: list[dict[str, str]] = []
    skipped: list[tuple[str, int, str]] = []

    for (year, q_pages), (_, a_pages) in zip(QUESTION_RANGES, ANSWER_RANGES):
        q_blocks = split_question_blocks(read_pages(reader, q_pages))
        a_blocks = split_answer_blocks(read_pages(reader, a_pages))
        for qnum, block in sorted(q_blocks.items()):
            question, choices = split_choices(block)
            answer_info = a_blocks.get(qnum, {})
            answer = answer_info.get("answer", "")
            explanation = answer_info.get("explanation", "")
            reason = should_skip(question, choices, answer, explanation)
            if reason:
                skipped.append((year, qnum, reason))
                continue

            row = {
                "問題": f"{year} 第{qnum}問：{question}",
                "選択肢1": choices[0] if len(choices) > 0 else "",
                "選択肢2": choices[1] if len(choices) > 1 else "",
                "選択肢3": choices[2] if len(choices) > 2 else "",
                "選択肢4": choices[3] if len(choices) > 3 else "",
                "選択肢5": choices[4] if len(choices) > 4 else "",
                "正解の選択肢": answer,
                "全体の解説": explanation,
                "1の解説": answer_info.get("choice_exp_1", ""),
                "2の解説": answer_info.get("choice_exp_2", ""),
                "3の解説": answer_info.get("choice_exp_3", ""),
                "4の解説": answer_info.get("choice_exp_4", ""),
                "5の解説": answer_info.get("choice_exp_5", ""),
            }
            rows.append(row)

    headers = ["問題", "選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5", "正解の選択肢", "全体の解説", "1の解説", "2の解説", "3の解説", "4の解説", "5の解説"]
    with OUT_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

    skip_path = OUT_PATH.with_name("24_kakomonn_jouhou_quiz_skipped.txt")
    skip_path.write_text("\n".join(f"{year} 第{qnum}問: {reason}" for year, qnum, reason in skipped), encoding="utf-8")
    print(f"created={len(rows)} skipped={len(skipped)} out={OUT_PATH} skip={skip_path}")


if __name__ == "__main__":
    main()
