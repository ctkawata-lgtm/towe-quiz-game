from __future__ import annotations

import copy
import re
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas


SOURCE_PDF = Path(r"C:\AIroom\codexcli\財務諸表理論アプリ\assets\pdfs\財務諸表論問題集.pdf")
OUTPUT_PDF = Path(r"C:\Users\kawat\Documents\Codex\2026-05-29\quiz_database\財務諸表論問題集_game_trial.pdf")

PROBLEM_CROP_LEFT = 39.7
PROBLEM_CROP_RIGHT_PADDING = 8
PROBLEM_CROP_BOTTOM = 113.4
QUESTION_MASK_X = 235
TABLE_TOP = 790
TABLE_BOTTOM = 105
ROW_CROP_LEFT = 68
ROW_CROP_RIGHT = 560
ROW_CROP_TOP_LIMIT = 778
ROW_CROP_BOTTOM_LIMIT = 98


def table_pages(reader: PdfReader) -> list[tuple[int, list[tuple[int, float]], str]]:
    pages: list[tuple[int, list[tuple[int, float]], str]] = []
    for page_no, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").replace("\n", " ")
        if "番号 問題 解答欄 解説" not in text:
            continue
        rows: list[tuple[int, float]] = []

        def visitor(fragment, cm, tm, font_dict, font_size):
            value = fragment.strip()
            if value.isdigit() and 70 <= tm[4] <= 95 and 80 <= tm[5] <= 780:
                rows.append((int(value), float(tm[5])))

        page.extract_text(visitor_text=visitor)
        rows = sorted(set(rows), key=lambda item: -item[1])
        title_match = re.search(r"第\s*([0-9０-９]+)\s*回\s*([^［\[]+)", text)
        title = title_match.group(0).strip() if title_match else f"PDF page {page_no}"
        if rows:
            pages.append((page_no, rows, title))
    return pages


def white_overlay(width: float, height: float, rectangles: list[tuple[float, float, float, float]]):
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=(width, height))
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(1, 1, 1)
    for x, y, w, h in rectangles:
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]


def masked_problem_page(reader: PdfReader, page_no: int):
    page = copy.copy(reader.pages[page_no - 1])
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    page.cropbox.lower_left = (PROBLEM_CROP_LEFT, PROBLEM_CROP_BOTTOM)
    page.cropbox.upper_right = (width - PROBLEM_CROP_RIGHT_PADDING, height)
    overlay = white_overlay(
        width,
        height,
        [(QUESTION_MASK_X, TABLE_BOTTOM, width - QUESTION_MASK_X - 25, TABLE_TOP - TABLE_BOTTOM)],
    )
    page.merge_page(overlay)
    return page


def row_bounds(rows: list[tuple[int, float]], index: int) -> tuple[float, float]:
    y = rows[index][1]
    previous_y = rows[index - 1][1] if index > 0 else None
    next_y = rows[index + 1][1] if index + 1 < len(rows) else None
    top = (previous_y + y) / 2 if previous_y is not None else ROW_CROP_TOP_LIMIT
    bottom = (y + next_y) / 2 if next_y is not None else ROW_CROP_BOTTOM_LIMIT
    return max(ROW_CROP_BOTTOM_LIMIT, bottom), min(ROW_CROP_TOP_LIMIT, top)


def cropped_answer_page(reader: PdfReader, page_no: int, rows: list[tuple[int, float]], index: int):
    page = copy.copy(reader.pages[page_no - 1])
    bottom, top = row_bounds(rows, index)
    page.cropbox.lower_left = (ROW_CROP_LEFT, bottom)
    page.cropbox.upper_right = (ROW_CROP_RIGHT, top)
    return page


def build_pdf() -> None:
    reader = PdfReader(str(SOURCE_PDF))
    pages = table_pages(reader)
    writer = PdfWriter()

    writer.add_metadata({
        "/Title": "財務諸表論問題集 game trial",
        "/Subject": "問題用ページは解答欄・解説欄を非表示、解答解説ページは1問ごとに切り出し",
    })

    problem_start = len(writer.pages) + 1
    for page_no, _rows, title in pages:
        writer.add_page(masked_problem_page(reader, page_no))
        writer.add_outline_item(f"問題 {title} / 元PDF {page_no}", len(writer.pages) - 1)

    answer_start = len(writer.pages) + 1
    for page_no, rows, title in pages:
        parent = writer.add_outline_item(f"解答解説 {title} / 元PDF {page_no}", len(writer.pages))
        for index, (question_no, _y) in enumerate(rows):
            writer.add_page(cropped_answer_page(reader, page_no, rows, index))
            writer.add_outline_item(f"問{question_no}", len(writer.pages) - 1, parent=parent)

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PDF.open("wb") as file:
        writer.write(file)

    print(OUTPUT_PDF)
    print(f"source_pages={len(reader.pages)}")
    print(f"table_pages={len(pages)}")
    print(f"problem_pages={len(pages)}")
    print(f"answer_pages={sum(len(rows) for _page_no, rows, _title in pages)}")
    print(f"problem_start={problem_start}")
    print(f"answer_start={answer_start}")
    print(f"total_pages={len(writer.pages)}")


if __name__ == "__main__":
    build_pdf()
