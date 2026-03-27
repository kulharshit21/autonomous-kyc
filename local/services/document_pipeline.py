from __future__ import annotations

from .ocr_adapter import extract_text_local
from ..utils.image_ops import (
    decode_base64_image,
    encode_image_to_base64,
    estimate_image_quality,
    extract_primary_face,
    preprocess_document_image,
)
from ..utils.pdf_ops import decode_pdf_base64, extract_pdf_text, render_pdf_pages_to_bgr
from ..utils.text_parsers import parse_document_text


def combine_unique_text_parts(*parts: str) -> str:
    seen: set[str] = set()
    combined_lines: list[str] = []
    for part in parts:
        for raw_line in (part or '').splitlines():
            line = ' '.join(raw_line.split()).strip()
            if not line:
                continue
            lowered = line.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            combined_lines.append(line)
    return '\n'.join(combined_lines)


def build_document_ocr_regions(processed_image, face_info: dict) -> list[tuple[str, object]]:
    height, width = processed_image.shape[:2]
    regions: list[tuple[str, object]] = [('full', processed_image)]

    bbox = face_info.get('face_bbox')
    if bbox:
        margin_x = int(bbox['w'] * 0.18)
        margin_y = int(bbox['h'] * 0.18)

        below_start = min(height, bbox['y'] + bbox['h'] + margin_y)
        if height - below_start > 100:
            regions.append(('below_face', processed_image[below_start:height, :]))

        if bbox['x'] + (bbox['w'] / 2.0) < (width / 2.0):
            side_start = min(width, bbox['x'] + bbox['w'] + margin_x)
            if width - side_start > 180:
                regions.append(('opposite_photo_side', processed_image[:, side_start:width]))
        else:
            side_end = max(0, bbox['x'] - margin_x)
            if side_end > 180:
                regions.append(('opposite_photo_side', processed_image[:, 0:side_end]))

    center_band = processed_image[int(height * 0.12):int(height * 0.82), int(width * 0.08):int(width * 0.92)]
    if center_band.size:
        regions.append(('center_band', center_band))

    return [(label, region) for label, region in regions if region is not None and region.size > 0]


def verify_document_local(image_base64: str, mime_type: str = 'image/jpeg') -> dict:
    local_warnings: list[str] = []
    embedded_text = ''
    page_images = []

    if mime_type == 'application/pdf':
        pdf_bytes = decode_pdf_base64(image_base64)
        page_images = render_pdf_pages_to_bgr(pdf_bytes, max_pages=2)
        image_bgr = page_images[0]
        embedded_text = extract_pdf_text(pdf_bytes)
        if embedded_text:
            local_warnings.append('Used embedded PDF text layer for extraction.')
        else:
            local_warnings.append('No embedded PDF text found; OCR on rendered page(s) will be used if available.')
    else:
        image_bgr = decode_base64_image(image_base64)
        page_images = [image_bgr]

    processed_image = preprocess_document_image(image_bgr)
    quality = estimate_image_quality(processed_image)
    face_info = extract_primary_face(processed_image)
    ocr_text_parts = [embedded_text]
    ocr_warnings: list[str] = []
    ocr_variant_reports: list[dict] = []
    ocr_engine_parts: list[str] = []

    for page_index, page_image in enumerate(page_images):
        processed_page = preprocess_document_image(page_image)
        page_face_info = face_info if page_index == 0 else extract_primary_face(processed_page)
        for region_label, region_image in build_document_ocr_regions(processed_page, page_face_info):
            region_result = extract_text_local(region_image)
            region_text = region_result.get('text', '').strip()
            if region_text:
                ocr_text_parts.append(region_text)
            ocr_warnings.extend(region_result.get('warnings', []))
            ocr_variant_reports.extend(
                {
                    **entry,
                    'page': page_index + 1,
                    'region': region_label,
                }
                for entry in region_result.get('variants', [])
            )
            engine_name = region_result.get('engine', 'unavailable')
            if engine_name != 'unavailable':
                ocr_engine_parts.append(engine_name)

    combined_text = combine_unique_text_parts(*ocr_text_parts)
    parsed = parse_document_text(combined_text)
    if embedded_text and ocr_engine_parts:
        ocr_engine = f"pdf_text+{'+'.join(sorted(set(ocr_engine_parts)))}"
    elif embedded_text:
        ocr_engine = 'pdf_text'
    elif ocr_engine_parts:
        ocr_engine = '+'.join(sorted(set(ocr_engine_parts)))
    else:
        ocr_engine = 'unavailable'

    has_photo = face_info['has_face'] and not face_info['multiple_faces']
    if not has_photo:
        id_photo_clarity = 'no_photo'
    elif face_info['face_area_ratio'] < 0.035 or face_info['face_quality_score'] < 40:
        id_photo_clarity = 'unclear'
    elif face_info['face_quality_score'] < 60:
        id_photo_clarity = 'slightly_unclear'
    else:
        id_photo_clarity = 'clear'

    quality_flags = list(face_info['quality_flags'])
    if quality['qualityScore'] < 40:
        quality_flags.append('low_document_quality')
    if quality['glare'] > 18:
        quality_flags.append('glare')

    filled_fields = sum(
        1 for value in [
            parsed['documentType'],
            parsed['extractedName'],
            parsed['dateOfBirth'],
            parsed['idNumber'],
            parsed['expiryDate']
        ] if value
    )

    confidence = 22
    confidence += min(28, filled_fields * 6)
    confidence += min(20, quality['qualityScore'] * 0.2)
    if has_photo:
        confidence += 12
    if id_photo_clarity == 'clear':
        confidence += 8
    elif id_photo_clarity == 'slightly_unclear':
        confidence += 3
    else:
        confidence -= 8
    if ocr_engine == 'unavailable':
        confidence = min(confidence, 45)
    if embedded_text:
        confidence = min(100, confidence + 18)
    elif mime_type == 'application/pdf':
        confidence = max(26, confidence)
    if parsed['address']:
        confidence += 6
    if parsed['extractedName']:
        confidence += 5

    confidence = max(0, min(100, round(confidence)))
    is_authentic = quality['qualityScore'] >= 35 and not face_info['multiple_faces']
    tampering_detected = face_info['multiple_faces'] and face_info['face_area_ratio'] > 0.12

    reason_parts = []
    if local_warnings:
        reason_parts.extend(local_warnings)
    if ocr_warnings:
        reason_parts.extend(sorted(set(ocr_warnings)))
    if quality_flags:
        reason_parts.append(f"Quality flags: {', '.join(sorted(set(quality_flags)))}")
    if not combined_text:
        reason_parts.append('No machine-readable document text could be extracted in the local offline path.')
    if not has_photo:
        reason_parts.append('No usable holder portrait was detected on the uploaded ID.')
    elif id_photo_clarity != 'clear':
        reason_parts.append('The holder portrait is present but not fully clear for matching.')

    return {
        'documentType': parsed['documentType'],
        'extractedName': parsed['extractedName'],
        'extractedDOB': parsed['dateOfBirth'],
        'idNumber': parsed['idNumber'],
        'address': parsed['address'],
        'expiryDate': parsed['expiryDate'],
        'hasPhotoInId': has_photo,
        'idPhotoClarity': id_photo_clarity,
        'isAuthentic': is_authentic,
        'tamperingDetected': tampering_detected,
        'confidenceScore': confidence,
        'authenticityReason': ' '.join(reason_parts).strip() or 'Local offline verification completed.',
        'processedImageBase64': encode_image_to_base64(processed_image),
        'processedMimeType': 'image/jpeg',
        'ocrEngine': ocr_engine,
        'ocrText': combined_text,
        'documentQuality': quality,
        'faceDetection': {
            'faceCount': face_info['face_count'],
            'faceAreaRatio': face_info['face_area_ratio'],
            'faceQualityScore': face_info['face_quality_score'],
            'qualityFlags': quality_flags,
        },
        'ocrVariants': ocr_variant_reports,
        'localWarnings': local_warnings + sorted(set(ocr_warnings))
    }
