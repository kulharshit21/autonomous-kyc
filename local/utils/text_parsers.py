from __future__ import annotations

import re


PASSPORT_PATTERN = re.compile(r'\b[A-PR-WY][0-9]{7}\b', re.IGNORECASE)
PAN_PATTERN = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b', re.IGNORECASE)
AADHAAR_PATTERN = re.compile(r'\b\d{12}\b|\b\d{4}(?:[ \t]+\d{4}){2}\b')
DOB_PATTERN = re.compile(r'\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})\b')
LICENCE_PATTERN = re.compile(r'\b[A-Z]{2}[ -]?\d{2}[ -]?\d{4,13}\b', re.IGNORECASE)
PINCODE_PATTERN = re.compile(r'\b\d{6}\b')


def clean_text_lines(text: str) -> list[str]:
    lines = []
    for raw_line in (text or '').splitlines():
        line = re.sub(r'\s+', ' ', raw_line).strip()
        if line:
            lines.append(line)
    return lines


def normalize_date(date_text: str) -> str:
    if not date_text:
        return ''

    date_text = date_text.replace('-', '/')
    if re.fullmatch(r'\d{4}/\d{2}/\d{2}', date_text):
        year, month, day = date_text.split('/')
        return f'{day}/{month}/{year}'
    return date_text


def infer_document_type(text: str) -> str:
    upper = (text or '').upper()
    if 'PASSPORT' in upper or PASSPORT_PATTERN.search(upper):
        return 'Passport'
    if 'INCOME TAX DEPARTMENT' in upper or PAN_PATTERN.search(upper):
        return 'PAN Card'
    if 'AADHAAR' in upper or 'GOVERNMENT OF INDIA' in upper or AADHAAR_PATTERN.search(upper):
        return 'Aadhaar Card'
    if 'DRIVING LICENCE' in upper or 'DRIVING LICENSE' in upper or LICENCE_PATTERN.search(upper):
        return 'Driving Licence'
    return 'Government ID'


def extract_id_number(text: str, document_type: str) -> str:
    upper = (text or '').upper()
    if document_type == 'Passport':
        match = PASSPORT_PATTERN.search(upper)
        return match.group(0).upper() if match else ''
    if document_type == 'PAN Card':
        match = PAN_PATTERN.search(upper)
        return match.group(0).upper() if match else ''
    if document_type == 'Aadhaar Card':
        match = AADHAAR_PATTERN.search(text or '')
        return re.sub(r'\s+', '', match.group(0)) if match else ''
    match = LICENCE_PATTERN.search(upper)
    if match:
        return re.sub(r'[\s-]+', '', match.group(0).upper())
    generic = re.search(r'\b[A-Z0-9]{6,18}\b', upper)
    return generic.group(0).upper() if generic else ''


def extract_dates(text: str) -> list[str]:
    return [normalize_date(item.group(0)) for item in DOB_PATTERN.finditer(text or '')]


def _alphabetic_ratio(text: str) -> float:
    stripped = re.sub(r'\s+', '', text)
    if not stripped:
        return 0.0
    alpha_count = sum(char.isalpha() for char in stripped)
    return alpha_count / len(stripped)


def _looks_like_address_line(line: str) -> bool:
    lower = line.lower()
    return (
        bool(PINCODE_PATTERN.search(line))
        or any(
            token in lower
            for token in [
                'address', 'road', 'rd', 'street', 'st', 'lane', 'ln', 'nagar', 'colony',
                'sector', 'district', 'dist', 'state', 'city', 'village', 'taluk',
                'taluka', 'mandal', 'post', 'po', 'house', 'flat', 'floor', 'near'
            ]
        )
    )


def _address_signal_score(text: str) -> int:
    lower = text.lower()
    score = 0
    keywords = [
        'address', 'road', 'street', 'lane', 'nagar', 'colony', 'sector', 'district',
        'state', 'city', 'village', 'post', 'house', 'flat', 'floor', 'near',
        'karnataka', 'maharashtra', 'delhi', 'bengaluru', 'bangalore', 'mumbai',
        'pune', 'hyderabad', 'chennai', 'india'
    ]
    score += sum(1 for keyword in keywords if keyword in lower)
    if PINCODE_PATTERN.search(text):
        score += 3
    if re.search(r'\b(?:house|flat|plot|door|room)\s*\d+\b', lower):
        score += 2
    if ',' in text:
        score += 1
    return score


def _is_noisy_text(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True

    allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,./:-')
    weird_count = sum(char not in allowed_chars for char in stripped)
    if weird_count >= 2:
        return True

    compact = re.sub(r'\s+', '', stripped)
    if compact and not PINCODE_PATTERN.search(stripped):
        digit_ratio = sum(char.isdigit() for char in compact) / len(compact)
        alpha_ratio = sum(char.isalpha() for char in compact) / len(compact)
        if digit_ratio > 0.45 or alpha_ratio < 0.45:
            return True
        suspicious_mixed_tokens = [
            token for token in re.split(r'[\s,./:-]+', compact)
            if token and any(char.isalpha() for char in token) and any(char.isdigit() for char in token)
        ]
        if len(suspicious_mixed_tokens) >= 2:
            return True

    return False


def _normalize_candidate_text(text: str) -> str:
    devanagari_digits = str.maketrans('०१२३४५६७८९', '0123456789')
    cleaned = text.translate(devanagari_digits)
    cleaned = re.sub(r'[^A-Za-z0-9,./:\- ]+', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' ,:-')
    return cleaned


def extract_name(text: str, document_type: str) -> str:
    lines = clean_text_lines(text)
    ignore_keywords = {
        'government', 'india', 'passport', 'driving', 'licence', 'license', 'department',
        'income', 'tax', 'date', 'birth', 'dob', 'male', 'female', 'address', 'signature'
    }

    best_candidate = ''
    best_score = -1
    id_value = extract_id_number(text, document_type)
    date_values = set(extract_dates(text))

    for index, line in enumerate(lines):
        letters_only = re.sub(r'[^A-Za-z\s]', '', line).strip()
        if len(letters_only.split()) < 2:
            continue
        if len(letters_only) < 6:
            continue
        lower = letters_only.lower()
        if any(keyword in lower for keyword in ignore_keywords):
            continue
        if sum(char.isalpha() for char in letters_only) < 6:
            continue
        if _looks_like_address_line(line):
            continue

        score = 0
        word_count = len(letters_only.split())
        if 2 <= word_count <= 4:
            score += 30
        elif word_count == 5:
            score += 18
        else:
            score -= 10

        score += min(20, int(_alphabetic_ratio(line) * 20))
        score += 12 if 10 <= len(letters_only) <= 32 else 4

        next_lines = ' '.join(lines[index + 1:index + 3]).lower()
        prev_lines = ' '.join(lines[max(0, index - 2):index]).lower()
        if any(token in next_lines for token in ['dob', 'birth', 'male', 'female']):
            score += 24
        if id_value and id_value in ''.join(lines[index + 1:index + 4]).replace(' ', ''):
            score += 16
        if any(token in prev_lines for token in ['aadhaar', 'passport', 'income tax department', 'driving licence', 'driving license']):
            score += 10
        if any(date in ' '.join(lines[index + 1:index + 3]) for date in date_values):
            score += 8

        if score > best_score:
            best_score = score
            best_candidate = letters_only.title()

    return best_candidate


def extract_address(text: str, document_type: str) -> str:
    lines = clean_text_lines(text)
    if not lines:
        return ''

    ignore_tokens = {
        'government of india', 'aadhaar', 'passport', 'income tax department',
        'driving licence', 'driving license', 'male', 'female', 'dob', 'date of birth'
    }
    id_value = extract_id_number(text, document_type)
    dob_values = set(extract_dates(text))

    address_candidates: list[str] = []
    capturing = False

    for line in lines:
        normalized_line = _normalize_candidate_text(line)
        lower = normalized_line.lower()
        compact = re.sub(r'\s+', '', normalized_line).upper()
        if any(token in lower for token in ignore_tokens):
            continue
        if id_value and id_value in compact:
            continue
        if any(date in normalized_line for date in dob_values):
            continue
        if _is_noisy_text(normalized_line):
            continue

        if 'address' in lower:
            capturing = True
            cleaned = re.sub(r'(?i)^address[:\s-]*', '', normalized_line).strip(' ,:-')
            if cleaned:
                address_candidates.append(cleaned)
            continue

        if capturing:
            if len(normalized_line) < 4:
                continue
            address_candidates.append(normalized_line)
            if len(address_candidates) >= 4 or PINCODE_PATTERN.search(normalized_line):
                break
            continue

        if _looks_like_address_line(normalized_line):
            address_candidates.append(normalized_line)

    address_candidates = [candidate for candidate in address_candidates if candidate and candidate.strip('- ')]
    if not address_candidates:
        return ''

    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in address_candidates:
        normalized = candidate.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(candidate)
        if len(deduped) >= 4:
            break

    has_pincode = any(PINCODE_PATTERN.search(candidate) for candidate in deduped)
    total_signal = sum(_address_signal_score(candidate) for candidate in deduped)
    if not capturing and not has_pincode:
        return ''
    if not capturing and len(deduped) < 2:
        return ''
    if total_signal < 3:
        return ''

    joined = ', '.join(deduped)
    if _is_noisy_text(joined.replace(',', ' ')):
        return ''
    return joined


def parse_document_text(text: str) -> dict:
    document_type = infer_document_type(text)
    dates = extract_dates(text)
    document_id = extract_id_number(text, document_type)
    name = extract_name(text, document_type)

    expiry_date = ''
    dob = ''
    if dates:
        dob = dates[0]
    if len(dates) > 1:
        expiry_date = dates[-1]

    return {
        'documentType': document_type,
        'extractedName': name,
        'dateOfBirth': dob,
        'idNumber': document_id,
        'expiryDate': expiry_date,
        'address': extract_address(text, document_type),
    }
