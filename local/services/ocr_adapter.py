from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
import torch

try:
    import easyocr
except Exception:  # pragma: no cover - handled gracefully
    easyocr = None


_easyocr_readers: dict[tuple[str, ...], object] = {}
_easyocr_errors: dict[tuple[str, ...], Exception] = {}


def get_easyocr_reader(languages: tuple[str, ...] = ('en',)):
    if languages in _easyocr_readers:
        return _easyocr_readers[languages]
    if languages in _easyocr_errors:
        raise _easyocr_errors[languages]
    if easyocr is None:
        error = RuntimeError('easyocr package is not available')
        _easyocr_errors[languages] = error
        raise error

    try:
        reader = easyocr.Reader(
            list(languages),
            gpu=torch.cuda.is_available(),
            download_enabled=False,
        )
        _easyocr_readers[languages] = reader
        return reader
    except Exception as error:  # pragma: no cover - depends on local model cache
        _easyocr_errors[languages] = error
        raise


def _to_rgb(image) -> np.ndarray:
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def _line_key(entry: tuple) -> tuple[float, float]:
    box = entry[0]
    xs = [point[0] for point in box]
    ys = [point[1] for point in box]
    return (float(sum(ys) / len(ys)), float(sum(xs) / len(xs)))


def _normalize_ocr_line(text: str) -> str:
    devanagari_digits = str.maketrans('०१२३४५६७८९', '0123456789')
    cleaned = str(text).translate(devanagari_digits).replace('|', 'I')
    return ' '.join(cleaned.split()).strip()


def _build_easyocr_variants(image_bgr) -> list[tuple[str, np.ndarray]]:
    variants: list[tuple[str, np.ndarray]] = [('base', image_bgr)]

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    variants.append(('clahe', enhanced))

    upscaled = cv2.resize(enhanced, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    variants.append(('upscaled', upscaled))

    binary = cv2.adaptiveThreshold(
        upscaled,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    variants.append(('adaptive', binary))

    sharpened = cv2.GaussianBlur(upscaled, (0, 0), 2.0)
    sharpened = cv2.addWeighted(upscaled, 1.6, sharpened, -0.6, 0)
    variants.append(('sharpened', sharpened))

    return variants


def _score_ocr_text(text: str, average_confidence: float) -> float:
    upper = (text or '').upper()
    score = average_confidence * 100.0
    if any(keyword in upper for keyword in ['AADHAAR', 'GOVERNMENT OF INDIA', 'PASSPORT', 'INCOME TAX DEPARTMENT']):
        score += 14.0
    if any(char.isdigit() for char in upper):
        score += 6.0
    if any(marker in upper for marker in ['DOB', 'BIRTH', 'MALE', 'FEMALE']):
        score += 8.0
    if len(text.splitlines()) >= 4:
        score += 6.0
    return score


def _read_easyocr_variant(reader, image_variant) -> dict:
    results = reader.readtext(_to_rgb(image_variant), detail=1, paragraph=False)
    results = [entry for entry in results if _normalize_ocr_line(entry[1])]
    results.sort(key=_line_key)

    text_lines = [_normalize_ocr_line(entry[1]) for entry in results]
    confidences = [float(entry[2]) for entry in results]
    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        'text': '\n'.join(text_lines),
        'lines': text_lines,
        'averageConfidence': average_confidence,
        'rawDetections': results,
    }


def _run_easyocr_for_languages(image_bgr, languages: tuple[str, ...]) -> dict:
    reader = get_easyocr_reader(languages)
    best_result = None
    best_score = -1.0
    evaluated_variants: list[dict] = []

    for variant_name, variant_image in _build_easyocr_variants(image_bgr):
        variant_result = _read_easyocr_variant(reader, variant_image)
        variant_score = _score_ocr_text(variant_result['text'], variant_result['averageConfidence'])
        evaluated_variants.append({
            'variant': variant_name,
            'languages': '+'.join(languages),
            'score': round(variant_score, 2),
            'averageConfidence': round(variant_result['averageConfidence'], 3),
        })
        if variant_score > best_score:
            best_score = variant_score
            best_result = variant_result

    return {
        'score': best_score,
        'text': best_result['text'] if best_result else '',
        'details': best_result or {'lines': [], 'averageConfidence': 0.0, 'rawDetections': []},
        'variants': evaluated_variants,
        'languages': languages,
    }


def extract_text_with_easyocr(image_bgr) -> dict:
    primary = _run_easyocr_for_languages(image_bgr, ('en',))
    candidates = [primary]

    if primary['score'] < 45 or len(primary['details']['lines']) < 4:
        candidates.append(_run_easyocr_for_languages(image_bgr, ('en', 'hi')))

    best = max(candidates, key=lambda item: item['score'])
    return {
        'engine': 'easyocr',
        'text': best['text'],
        'warnings': [],
        'details': best['details'],
        'variants': [entry for candidate in candidates for entry in candidate['variants']],
        'languages': '+'.join(best['languages']),
    }


def extract_text_with_tesseract(image_bgr) -> dict:
    executable = shutil.which('tesseract')
    if not executable:
        raise RuntimeError('tesseract executable not found')

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as image_file:
        image_path = Path(image_file.name)
    try:
        cv2.imwrite(str(image_path), image_bgr)
        result = subprocess.run(
            [executable, str(image_path), 'stdout', '--psm', '6'],
            capture_output=True,
            text=True,
            check=True
        )
        return {
            'engine': 'tesseract',
            'text': result.stdout.strip(),
            'warnings': [],
            'details': {'lines': result.stdout.splitlines(), 'averageConfidence': 0.0, 'rawDetections': []},
            'variants': [{'variant': 'tesseract', 'score': 0.0, 'averageConfidence': 0.0}],
        }
    finally:
        image_path.unlink(missing_ok=True)


def extract_text_local(image_bgr) -> dict:
    warnings = []

    try:
        return extract_text_with_easyocr(image_bgr)
    except Exception as error:
        warnings.append(f'EasyOCR unavailable locally: {error}')

    try:
        result = extract_text_with_tesseract(image_bgr)
        result['warnings'] = warnings + result.get('warnings', [])
        return result
    except Exception as error:
        warnings.append(f'Tesseract unavailable locally: {error}')

    return {
        'engine': 'unavailable',
        'text': '',
        'warnings': warnings + [
            'No local OCR engine is fully ready. Add EasyOCR model files or install Tesseract to enable offline OCR.'
        ],
        'details': {'lines': [], 'averageConfidence': 0.0, 'rawDetections': []},
        'variants': [],
    }
