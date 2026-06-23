from __future__ import annotations

import logging
import sys
from collections import OrderedDict
from pathlib import Path

import openpyxl
from pypdf import PdfReader

import build_cpa_boki_past_pdf_game_xlsx as base


sys.stdout.reconfigure(encoding="utf-8")
logging.getLogger("pypdf").setLevel(logging.ERROR)

PDF_PATH = Path(r"C:\Users\kawat\Downloads\財務会計論_簿記_cpa_過去問_最終.pdf")
OUT_PATH = Path(r"C:\Users\kawat\Documents\Codex\2026-05-29\quiz_database\財務会計論_簿記_cpa_過去問_最終_pdf_game.xlsx")
MAX_SUBQUESTIONS = 25


base.PDF_PATH = PDF_PATH
base.OUT_PATH = OUT_PATH
base.MAX_SUBQUESTIONS = MAX_SUBQUESTIONS


def find_explanation_start(texts: list[str], key_page: int, answer_end: int) -> int:
    """Prefer explanation pages for the in-game answer/explanation view."""
    for page_no in range(key_page + 1, answer_end + 1):
        text = base.compact(texts[page_no - 1][:1200])
        if "＜解説＞" in text or "【解説】" in text or "解説" in text:
            return page_no
    return key_page


def is_auto_gradable_answer(answer: str) -> bool:
    value = answer.strip()
    if base.re.fullmatch(r"[△▲-]?\d[\d,]*(?:\.\d+)?", value):
        return True
    if base.re.fullmatch(r"[○×〇あ-おア-オ1-5]{1,3}", value):
        return True
    if base.re.fullmatch(r"[益損]{1,2}", value):
        return True
    return False


def main_problem_no(label: str) -> str:
    match = base.re.search(r"問題\s*([0-9０-９]+)", label)
    if not match:
        return "0"
    return str(int(match.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789"))))


def compact_for_match(text: str) -> str:
    return base.compact(text).translate(str.maketrans("０１２３４５６７８９－", "0123456789-"))


def page_mentions_problem(text: str, main_no: str) -> bool:
    compact = compact_for_match(text)
    return bool(base.re.search(rf"問題{base.re.escape(main_no)}(?:-|[^\d]|$)", compact))


def page_declares_problem_range(text: str, main_no: str) -> bool:
    compact = compact_for_match(text)
    target = int(main_no)
    for match in base.re.finditer(r"問題(\d{1,2})[～~]問題(\d{1,2})", compact):
        start, end = int(match.group(1)), int(match.group(2))
        if start <= target <= end:
            return True
    return False


def range_for_main_problem(texts: list[str], start_page: int, end_page: int, main_no: str, fallback: tuple[int, int]) -> tuple[int, int]:
    if any(page_declares_problem_range(texts[page_no - 1], main_no) for page_no in range(start_page, end_page + 1)):
        return fallback
    pages = [
        page_no
        for page_no in range(start_page, end_page + 1)
        if page_mentions_problem(texts[page_no - 1], main_no)
    ]
    if not pages:
        return fallback
    return min(pages), max(pages)


def grouped_stages(
    texts: list[str],
    base_id: str,
    title: str,
    question_start: int,
    question_end: int,
    answer_start: int,
    answer_end: int,
    answers: list[base.SubAnswer],
) -> list[base.Stage]:
    groups: OrderedDict[str, list[base.SubAnswer]] = OrderedDict()
    for answer in answers:
        groups.setdefault(main_problem_no(answer.label), []).append(answer)

    stages: list[base.Stage] = []
    for group_index, (main_no, subanswers) in enumerate(groups.items(), start=1):
        q_start, q_end = range_for_main_problem(
            texts, question_start, question_end, main_no, (question_start, question_end)
        )
        a_start, a_end = range_for_main_problem(
            texts, answer_start, answer_end, main_no, (answer_start, answer_end)
        )
        if len(subanswers) > MAX_SUBQUESTIONS:
            split = base.split_stage(
                f"{base_id}_Q{int(main_no):02d}",
                f"{title} 問題{main_no}",
                q_start,
                q_end,
                a_start,
                a_end,
                subanswers,
            )
            stages.extend(split)
        else:
            stages.append(
                base.Stage(
                    f"{base_id}_Q{int(main_no):02d}",
                    f"{title} 問題{main_no}",
                    q_start,
                    q_end,
                    a_start,
                    a_end,
                    subanswers,
                )
            )
    return stages


def collect_stages(texts: list[str]) -> tuple[list[base.Stage], list[str]]:
    key_pages = [idx for idx, text in enumerate(texts, start=1) if base.is_answer_key(text)]
    stages: list[base.Stage] = []
    skipped: list[str] = []
    search_start = 1

    for key_index, key_page in enumerate(key_pages, start=1):
        title = base.title_from_answer_page(texts[key_page - 1], key_index)
        answers = base.parse_answer_key(texts[key_page - 1])
        if not answers:
            skipped.append(f"key_page={key_page}: 解答一覧を抽出できませんでした: {title}")
            continue

        rejected = [answer for answer in answers if not is_auto_gradable_answer(answer.answer)]
        answers = [answer for answer in answers if is_auto_gradable_answer(answer.answer)]
        for answer in rejected:
            skipped.append(f"key_page={key_page}: 自動採点しにくい解答を除外: {title} / {answer.label} = {answer.answer}")
        if not answers:
            skipped.append(f"key_page={key_page}: すべて自動採点対象外でした: {title}")
            continue

        question_start, question_end = base.find_problem_run(texts, search_start, key_page)
        next_key_page = key_pages[key_index] if key_index < len(key_pages) else None
        answer_end = base.find_answer_end(texts, key_page, next_key_page)
        answer_start = find_explanation_start(texts, key_page, answer_end)

        base_id = f"CPA簿記最終{key_index:03d}"
        stages.extend(grouped_stages(texts, base_id, title, question_start, question_end, answer_start, answer_end, answers))
        search_start = answer_end + 1

    return stages, skipped


def patch_usage_sheet() -> None:
    wb = openpyxl.load_workbook(OUT_PATH)
    ws = wb["使い方"]
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str):
                cell.value = cell.value.replace("小問が20個を超える答練はpart分割しています。", "小問が25個を超える答練はpart分割しています。")
                cell.value = cell.value.replace("解答一覧ページから", "解答一覧ページから正解を抽出し、ゲーム表示は解説ページを優先して")
    wb.save(OUT_PATH)


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    texts = [page.extract_text() or "" for page in reader.pages]
    stages, skipped = collect_stages(texts)
    base.write_workbook(stages, skipped, len(texts))
    patch_usage_sheet()

    total_subanswers = sum(len(stage.subanswers) for stage in stages)
    multi_page_question = sum(1 for stage in stages if stage.question_end > stage.question_start)
    multi_page_answer = sum(1 for stage in stages if stage.answer_end > stage.answer_start)
    print(f"pdf_pages={len(texts)}")
    print(f"stages={len(stages)}")
    print(f"subanswers={total_subanswers}")
    print(f"skipped={len(skipped)}")
    print(f"multi_page_question_stages={multi_page_question}")
    print(f"multi_page_answer_stages={multi_page_answer}")
    print(f"output={OUT_PATH}")
    print("samples=")
    for stage in stages[:8]:
        first = stage.subanswers[0]
        print(
            f"  {stage.problem_id}: q={stage.question_start}-{stage.question_end} "
            f"explain={stage.answer_start}-{stage.answer_end} sub={len(stage.subanswers)} "
            f"first={first.label}:{first.answer}"
        )
    if skipped:
        print("skipped_samples=")
        for item in skipped[:20]:
            print(f"  {item}")


if __name__ == "__main__":
    main()
