# local

This folder contains a separate offline/local KYC pipeline.

It does not replace the current API-based backend. It exists in parallel so local OCR, local face recognition, local liveness, and local risk scoring can be developed and tested independently.

## Main files

- `app.py`
  Local FastAPI server
- `services/document_pipeline.py`
  Document preprocessing, face-on-ID detection, OCR adapter, field extraction
- `services/face_pipeline.py`
  Local face crop extraction, feature fusion, match decision
- `services/liveness_pipeline.py`
  Local liveness heuristics from guided capture frames
- `services/risk_local.py`
  Offline risk calculation
- `utils/image_ops.py`
  Shared image decoding, enhancement, quality metrics, face utilities
- `utils/text_parsers.py`
  Local text parsing and document field extraction
- `tests/smoke_test.py`
  Basic local smoke checks

## Start the local server

```powershell
cd d:\per\autonomous-kyc
python -m uvicorn local.app:app --host 127.0.0.1 --port 8010
```

## Health check

```powershell
Invoke-RestMethod http://127.0.0.1:8010/api/health
```

## Notes

- The current machine already has `torch`, `torchvision`, `opencv-python`, `fastapi`, and `easyocr`.
- EasyOCR still needs local recognition weights on disk to perform OCR fully offline.
- If Tesseract is installed later, the OCR adapter can use it without changing the rest of the local pipeline.
