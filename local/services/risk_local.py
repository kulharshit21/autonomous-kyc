from __future__ import annotations


def normalize_name(value: str) -> str:
    return ' '.join(''.join(char.lower() if char.isalpha() or char.isspace() else ' ' for char in (value or '')).split())


def normalize_id(value: str) -> str:
    return ''.join(char for char in (value or '').upper() if char.isalnum())


def normalize_date(value: str) -> str:
    if not value:
        return ''
    value = value.replace('-', '/').strip()
    parts = value.split('/')
    if len(parts) == 3 and len(parts[0]) == 4:
        return f'{parts[2]}/{parts[1]}/{parts[0]}'
    return value


def calculate_local_risk(document_result: dict, face_result: dict, customer_info: dict) -> dict:
    data_consistency_risk = 0
    entered_name = normalize_name(customer_info.get('fullName', ''))
    extracted_name = normalize_name(document_result.get('extractedName', ''))
    if entered_name and extracted_name and entered_name != extracted_name:
        data_consistency_risk += 8

    entered_dob = normalize_date(customer_info.get('dateOfBirth', ''))
    extracted_dob = normalize_date(document_result.get('extractedDOB', ''))
    if entered_dob and extracted_dob and entered_dob != extracted_dob:
        data_consistency_risk += 4

    entered_id = normalize_id(customer_info.get('idNumber', ''))
    extracted_id = normalize_id(document_result.get('idNumber', ''))
    if entered_id and extracted_id and entered_id != extracted_id:
        data_consistency_risk += 10

    data_consistency_risk = min(15, data_consistency_risk)

    document_confidence = float(document_result.get('confidenceScore') or 0)
    if document_result.get('tamperingDetected') is True:
        document_authenticity_risk = 30
    elif document_result.get('isAuthentic') is False:
        document_authenticity_risk = 18 if document_confidence >= 45 else 24
    elif document_confidence < 45:
        document_authenticity_risk = 10
    elif document_confidence < 65:
        document_authenticity_risk = 5
    else:
        document_authenticity_risk = 0

    face_decision = str(face_result.get('faceDecision', '')).upper()
    match_score = float(face_result.get('matchScore') or 0)
    if face_decision in {'NO_MATCH', 'SPOOF_FAIL'}:
        face_match_risk = 30
    elif face_decision == 'RECAPTURE':
        face_match_risk = 20
    elif face_decision == 'REVIEW':
        face_match_risk = 15
    elif match_score >= 85:
        face_match_risk = 0
    elif match_score >= 72:
        face_match_risk = 5
    else:
        face_match_risk = 12

    live_score = float(face_result.get('liveSessionLivenessScore') or face_result.get('livenessConfidence') or 0)
    if live_score < 45:
        liveness_risk = 10
    elif live_score < 60:
        liveness_risk = 6
    elif live_score < 80:
        liveness_risk = 3
    else:
        liveness_risk = 0

    expiry_risk = 0 if document_result.get('expiryDate') in {'', 'No Expiry'} else 0

    risk_score = round(document_authenticity_risk + face_match_risk + data_consistency_risk + liveness_risk + expiry_risk)
    risk_score = max(0, min(100, risk_score))

    if face_decision in {'NO_MATCH', 'SPOOF_FAIL'}:
        decision = 'rejected'
        risk_category = 'high'
        risk_score = max(risk_score, 75)
    elif risk_score <= 30:
        decision = 'approved'
        risk_category = 'low'
    elif risk_score <= 70:
        decision = 'review'
        risk_category = 'medium'
    else:
        decision = 'rejected'
        risk_category = 'high'

    explanation = (
        f'Local offline scoring produced {risk_score}/100 with document risk {document_authenticity_risk}, '
        f'face risk {face_match_risk}, consistency risk {data_consistency_risk}, and liveness risk {liveness_risk}.'
    )

    return {
        'riskScore': risk_score,
        'riskCategory': risk_category,
        'decision': decision,
        'explanation': explanation,
        'breakdown': {
            'documentAuthenticityRisk': document_authenticity_risk,
            'faceMatchRisk': face_match_risk,
            'expiryRisk': expiry_risk,
            'dataConsistencyRisk': data_consistency_risk,
            'livenessRisk': liveness_risk,
        }
    }
