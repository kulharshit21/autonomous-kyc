from __future__ import annotations

import base64
import os
import sys

import cv2
import fitz
import numpy as np


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from local.services.document_pipeline import verify_document_local
from local.services.face_pipeline import verify_face_local
from local.services.risk_local import calculate_local_risk
from local.utils.image_ops import encode_image_to_base64


def build_blank_image(label: str) -> str:
    image = np.full((480, 640, 3), 245, dtype=np.uint8)
    cv2.putText(image, label, (40, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (40, 40, 40), 2, cv2.LINE_AA)
    return encode_image_to_base64(image)


def build_pdf_base64(text: str) -> str:
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((72, 120), text, fontsize=16)
    pdf_bytes = document.tobytes()
    return base64.b64encode(pdf_bytes).decode('ascii')


def main() -> None:
    blank_document = build_blank_image('LOCAL DOC')
    blank_selfie = build_blank_image('LOCAL SELFIE')
    pdf_document = build_pdf_base64(
        'Government of India\nAadhaar\nHarshit Ravindra Kulkarni\nDOB: 01/01/2000\n1234 5678 9012'
    )

    document_result = verify_document_local(blank_document, 'image/jpeg')
    assert 'confidenceScore' in document_result
    assert 'authenticityReason' in document_result

    pdf_result = verify_document_local(pdf_document, 'application/pdf')
    assert pdf_result['documentType'] in {'Aadhaar Card', 'Government ID'}
    assert pdf_result['ocrText']
    assert pdf_result['ocrEngine'] in {'pdf_text', 'pdf_text+easyocr', 'easyocr'}

    face_result = verify_face_local(blank_document, blank_selfie, [])
    assert 'faceDecision' in face_result
    assert 'matchScore' in face_result

    risk = calculate_local_risk(
        document_result,
        face_result,
        {'fullName': 'Test User', 'dateOfBirth': '2000-01-01', 'idNumber': 'ABC1234'}
    )
    assert 'riskScore' in risk
    assert 'decision' in risk

    print('local smoke test: ok')


if __name__ == '__main__':
    main()
