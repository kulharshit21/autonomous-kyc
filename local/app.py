from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .services.document_pipeline import verify_document_local
from .services.face_pipeline import verify_face_local
from .services.risk_local import calculate_local_risk

logger = logging.getLogger(__name__)


app = FastAPI(title='Local Offline KYC', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
    ],
    allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?$',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class DocumentItem(BaseModel):
    imageBase64: str
    mimeType: str = 'image/jpeg'


class VerifyDocumentRequest(BaseModel):
    imageBase64: str | None = None
    mimeType: str | None = None
    documents: list[DocumentItem] | None = None


class VerifyFaceRequest(BaseModel):
    idImageBase64: str
    selfieBase64: str
    livenessFrames: list[str] | None = None
    liveFrameQualityScores: list[dict[str, Any]] | None = None
    primaryFrameStep: str | None = None
    primaryFrameQualityScore: float | None = None


class ScoreRiskRequest(BaseModel):
    documentResult: dict[str, Any]
    faceResult: dict[str, Any]
    customerInfo: dict[str, Any]


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception('Unhandled local backend error on %s %s', request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            'success': False,
            'error': str(exc) or 'Internal local backend error'
        }
    )


@app.get('/api/health')
def health() -> dict:
    return {
        'status': 'ok',
        'mode': 'local-offline',
        'ocr': 'adapter',
        'face': 'opencv-fusion'
    }


@app.post('/api/kyc/verify-document')
def verify_document(payload: VerifyDocumentRequest) -> dict:
    if payload.documents:
        document = payload.documents[0]
        result = verify_document_local(document.imageBase64, document.mimeType)
    else:
        result = verify_document_local(payload.imageBase64 or '', payload.mimeType or 'image/jpeg')

    return {
        'success': True,
        'data': result
    }


@app.post('/api/kyc/verify-face')
def verify_face(payload: VerifyFaceRequest) -> dict:
    result = verify_face_local(
        payload.idImageBase64,
        payload.selfieBase64,
        payload.livenessFrames or [],
        payload.liveFrameQualityScores or [],
        payload.primaryFrameStep or '',
        payload.primaryFrameQualityScore or 0,
    )
    return {
        'success': True,
        'data': result
    }


@app.post('/api/kyc/score-risk')
def score_risk(payload: ScoreRiskRequest) -> dict:
    result = calculate_local_risk(
        payload.documentResult,
        payload.faceResult,
        payload.customerInfo,
    )
    return {
        'success': True,
        'data': result
    }
