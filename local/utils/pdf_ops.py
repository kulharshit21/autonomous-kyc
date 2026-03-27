from __future__ import annotations

import base64
import io

import fitz
import numpy as np


def decode_pdf_base64(pdf_base64: str) -> bytes:
    return base64.b64decode(pdf_base64)


def _pixmap_to_bgr(pix: fitz.Pixmap) -> np.ndarray:
    image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 3:
        return image[:, :, ::-1].copy()
    return image.copy()


def render_pdf_pages_to_bgr(pdf_bytes: bytes, zoom: float = 3.0, max_pages: int = 2) -> list[np.ndarray]:
    document = fitz.open(stream=pdf_bytes, filetype='pdf')
    if document.page_count == 0:
        raise ValueError('PDF has no pages')

    images: list[np.ndarray] = []
    matrix = fitz.Matrix(zoom, zoom)
    for page_index in range(min(document.page_count, max_pages)):
        page = document.load_page(page_index)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        images.append(_pixmap_to_bgr(pix))
    return images


def render_pdf_first_page_to_bgr(pdf_bytes: bytes, zoom: float = 3.0) -> np.ndarray:
    return render_pdf_pages_to_bgr(pdf_bytes, zoom=zoom, max_pages=1)[0]


def extract_pdf_text(pdf_bytes: bytes) -> str:
    document = fitz.open(stream=pdf_bytes, filetype='pdf')
    text_parts: list[str] = []
    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        page_text = page.get_text('text').strip()
        if page_text:
            text_parts.append(page_text)
    return '\n'.join(text_parts).strip()
