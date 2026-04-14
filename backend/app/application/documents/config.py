from __future__ import annotations

import re

from app.constants.vehicles import PLACEHOLDER_EXTERNAL_ID
from app.models.enums import RepairStatus


TESSERACT_LANGUAGE = "rus+eng"
TESSERACT_PAGE_SEGMENTATION_MODES = ("6", "4")

OCR_CONFUSABLE_CHARSETS = {
    "а": "аa4@",
    "б": "б6b",
    "в": "вb8",
    "г": "гgr",
    "д": "дdg",
    "е": "еe",
    "з": "з3",
    "и": "иu",
    "к": "кk",
    "м": "мm",
    "н": "нh",
    "о": "оo0",
    "п": "пnp",
    "р": "рpr",
    "с": "сc",
    "т": "тt",
    "у": "уy",
    "х": "хx",
}
SOURCE_PATH_KEY = "source_path"
RUSSIAN_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}
FILENAME_SERVICE_PREFIXES = (
    "заказ наряды",
    "заказ-наряды",
    "заказ наряды ",
    "заказ-наряд",
)
REPEAT_REPAIR_WINDOW_DAYS = 30
EXPECTED_TOTAL_THRESHOLD_MULTIPLIER = 1.1
EXPECTED_TOTAL_SERVICE_SAMPLE_THRESHOLD = 3
EXPECTED_TOTAL_HOURLY_SAMPLE_THRESHOLD = 5
WORK_REFERENCE_MIN_SAMPLES = 3
WORK_REFERENCE_SERVICE_SAMPLE_THRESHOLD = 3
WORK_REFERENCE_VEHICLE_SAMPLE_THRESHOLD = 2
WORK_REFERENCE_WARNING_MULTIPLIER = 1.2
WORK_REFERENCE_SUSPICIOUS_MULTIPLIER = 1.35
WORK_REFERENCE_WARNING_LOWER_MULTIPLIER = 0.8
WORK_REFERENCE_SUSPICIOUS_LOWER_MULTIPLIER = 0.65
WORK_REFERENCE_MILEAGE_MARGIN_RATIO = 0.2
WORK_REFERENCE_MIN_MILEAGE_MARGIN = 10000
HISTORICAL_IMPORT_REASON_PREFIX = "historical_import:"
PLACEHOLDER_VEHICLE_EXTERNAL_ID = PLACEHOLDER_EXTERNAL_ID
WORK_REFERENCE_OPERATIONAL_STATUSES = (
    RepairStatus.CONFIRMED,
    RepairStatus.EMPLOYEE_CONFIRMED,
)
EXPECTED_TOTAL_REPAIR_STATUSES = (
    RepairStatus.CONFIRMED,
    RepairStatus.EMPLOYEE_CONFIRMED,
    RepairStatus.SUSPICIOUS,
)


def fuzzy_char_pattern(char: str) -> str:
    lower_char = char.lower()
    charset = OCR_CONFUSABLE_CHARSETS.get(lower_char)
    if charset is None:
        return re.escape(char)
    return f"[{re.escape(charset)}]"


def fuzzy_word_pattern(word: str) -> str:
    return "".join(fuzzy_char_pattern(char) for char in word)


def fuzzy_phrase_pattern(*words: str) -> str:
    return r"[\s-]*".join(fuzzy_word_pattern(word) for word in words)


ORDER_LABEL_PATTERN = fuzzy_phrase_pattern("заказ", "наряд")
REVERSED_ORDER_LABEL_PATTERN = fuzzy_phrase_pattern("наряд", "заказ")
ACT_LABEL_PATTERN = fuzzy_word_pattern("акт")
ACT_WORKS_LABEL_PATTERN = fuzzy_phrase_pattern("акт", "выполненных", "работ")
DOCUMENT_LABEL_PATTERN = fuzzy_word_pattern("документ")
NUMBER_MARKER_PATTERN = r"(?:№|N[Ooº°]?|#)"
DATE_CLOSED_LABEL_PATTERN = fuzzy_phrase_pattern("дата", "закрытия")
DATE_COMPLETED_LABEL_PATTERN = fuzzy_phrase_pattern("дата", "окончания", "работ")
DATE_LABEL_PATTERN = fuzzy_word_pattern("дата")
FROM_LABEL_PATTERN = fuzzy_word_pattern("от")
MILEAGE_LABEL_PATTERN = fuzzy_word_pattern("пробег")
ODOMETER_LABEL_PATTERN = fuzzy_word_pattern("одометр")
SERVICE_LABEL_PATTERN = "|".join(
    [
        fuzzy_word_pattern("поставщик"),
        fuzzy_word_pattern("исполнитель"),
        fuzzy_word_pattern("подрядчик"),
        fuzzy_word_pattern("контрагент"),
    ]
)
WORK_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("работы", "итого"),
        fuzzy_phrase_pattern("стоимость", "работ"),
        fuzzy_phrase_pattern("итого", "работ"),
    ]
)
PARTS_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("запчасти", "итого"),
        fuzzy_phrase_pattern("материалы", "итого"),
        fuzzy_phrase_pattern("стоимость", "запчастей"),
        fuzzy_phrase_pattern("стоимость", "материалов"),
        fuzzy_word_pattern("запчасти"),
        fuzzy_word_pattern("материалы"),
    ]
)
VAT_LABEL_PATTERN = fuzzy_word_pattern("ндс")
GRAND_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("итого", "к", "оплате"),
        fuzzy_phrase_pattern("к", "оплате"),
        fuzzy_word_pattern("итого"),
        fuzzy_word_pattern("всего"),
    ]
)

ORDER_PATTERNS = [
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN})\s*{NUMBER_MARKER_PATTERN}?\s*([A-Za-zА-Яа-я0-9/_-]{{3,}})",
    rf"(?:{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN})\s*{NUMBER_MARKER_PATTERN}?\s*([A-Za-zА-Яа-я0-9/_-]{{3,}})",
    rf"\b{NUMBER_MARKER_PATTERN}\s*([A-Za-zА-Яа-я0-9/_-]{{4,}})",
    r"\b([A-Z]{2,}[A-Z0-9/_-]*-\d{2,})\b",
]
DATE_PATTERNS = [
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN}|{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN}|{DOCUMENT_LABEL_PATTERN})"
    rf"[^\n\r]{{0,80}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN}|{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN}|{DOCUMENT_LABEL_PATTERN})"
    rf"[^\n\r]{{0,80}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    rf"(?:{DATE_CLOSED_LABEL_PATTERN}|{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{DATE_CLOSED_LABEL_PATTERN}|{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    rf"(?:{DATE_LABEL_PATTERN}|{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{DATE_LABEL_PATTERN}|{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    r"\b(\d{2}[./-]\d{2}[./-]\d{2,4})\b",
]
MILEAGE_PATTERNS = [
    rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*(\d[\d\s]{{1,}})",
]
PLATE_PATTERNS = [
    r"([А-ЯA-Z]\s*\d{3}\s*[А-ЯA-Z]{2}\s*\d{2,3})(?!\d)",
    r"(\d{3}\s*[А-ЯA-Z]{3}\s*\d{2,3})(?!\d)",
    r"([А-ЯA-Z]{2}\s*\d{4}\s*\d{2,3})(?!\d)",
    r"(\d{4}\s*[А-ЯA-Z]{2}\s*\d{2,3})(?!\d)",
]
VIN_PATTERNS = [
    r"(?<![A-HJ-NPR-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-HJ-NPR-Z0-9])",
]
PLATE_LABEL_PATTERNS = [
    rf"(?:гос\.?\s*(?:номер|ном\.?\s*знак)|госномер|г/н|г\.\s*н\.)\s*[:№]?\s*(?P<value>[^\n\r]{{0,48}})",
]
VIN_LABEL_PATTERNS = [
    rf"(?:\bvin\b|vin)\s*[:№]?\s*(?P<value>[A-HJ-NPR-Z0-9]{{17}})",
    rf"(?:\bvin\b|vin)[^\n\r]{{0,60}}?(?P<value>[A-HJ-NPR-Z0-9]{{17}})",
]
CHASSIS_LABEL_PATTERNS = [
    r"(?:№\s*шасси|шасси|рама)\s*[:№]?\s*(?P<value>[A-Z0-9-]{6,20})",
]
MILEAGE_SECTION_PATTERNS = [
    rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*(?P<value>\d[\d\s]{{0,}})",
]
VEHICLE_ROW_MILEAGE_PATTERNS = [
    r"\b(\d{3}(?:\s\d{3}){0,3})\b(?=\s+(?:закрыт|открыт|rub|rur|руб|usd|eur)\b)",
    r"\b(\d{3}(?:\s\d{3}){0,3})\b(?=\s+(?:vin|вид\s+ремонта|дата\s+приема)\b)",
]
VEHICLE_SECTION_START_PATTERN = re.compile(
    r"(?:TC|ТС|Автомобиль|ТРАНСПОРТНОЕ\s+СРЕДСТВО|Модель автомобиля|Марка:)\b",
    re.IGNORECASE,
)
VEHICLE_SECTION_STOP_PATTERN = re.compile(
    r"(?:^|\n)\s*(?:ВЛАДЕЛЕЦ|Заказчик|ЗАКАЗЧИК|ПЛАТЕЛЬЩИК|Плательщик|Причина(?:\s+обращения)?|Вид ремонта|"
    r"Выполненные работы|ДОГОВОР|Контактное\s+лицо)\b",
    re.IGNORECASE,
)
SERVICE_PATTERNS = [
    rf"(?:{SERVICE_LABEL_PATTERN})\b\s*[:№]?\s*(.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|заказчик|плательщик|автомобиль|шасси|vin|договор|документ|заказ[- ]наряд|акт)\b)|$)",
]
SERVICE_CANDIDATE_PATTERNS = [
    re.compile(
        rf"(?:^|\n)\s*(?:{SERVICE_LABEL_PATTERN})\b\s*[:№]?\s*(?P<value>.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|заказчик|плательщик|автомобиль|шасси|vin|договор|документ|заказ[- ]наряд|акт)\b)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    ),
    re.compile(
        r"^(?:официальный\s+дилер[^\n\r]{0,80})?(?P<value>.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|цех|заказ[- ]наряд|акт\s+выполненных\s+работ|документ)\b)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    ),
]
REASON_LABEL_PATTERN = fuzzy_phrase_pattern("причина", "обращения")
REASON_SECTION_PATTERNS = [
    re.compile(
        rf"(?:^|\n)\s*(?:{REASON_LABEL_PATTERN})\s*[:№]?\s*(?P<value>.+?)"
        r"(?=(?:\n\s*(?:Выполненные\s+работы|Расходная\s+накладная|Акт\s+выполненных\s+работ|"
        r"Перечень\s+работ|Выполненные\s+сервисные\s+услуги|№\s+Артикул|Итого\s+работ|"
        r"Итого\s+по\s+причине\s+обращения)\b)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    ),
]
TOTAL_PATTERNS = {
    "work_total": [
        r"Итого\s+работ:\s*\d+\s+\d+(?:[.,]\d+)?\s+(\d[\d\s]*(?:[.,]\d{2}))\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})",
        r"Итого\s+работ:\s*(?:\d+(?:[.,]\d+)?)?[^\n\r]{0,80}?на\s+сумму:\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        r"Всего\s+выполнено\s+работ\s+на\s+сумму\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        rf"(?:{WORK_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:запчаст|материал|ндс|итого|сервис|сто|$))",
    ],
    "parts_total": [
        r"Итого\s+материалов:\s*\d+\s+(\d[\d\s]*(?:[.,]\d{2}))\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})",
        r"Итого\s+материал(?:ов|ы):\s*(?:\d+(?:[.,]\d+)?)?[^\n\r]{0,80}?на\s+сумму:\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        r"Итого\s+по\s+странице\s+материалов:\s*(?:\d+)?[^\n\r]{0,40}?на\s+сумму:\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        r"Затрачено\s+материалов\s+на\s+сумму\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        rf"(?:{PARTS_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:ндс|итого|сервис|сто|$))",
    ],
    "vat_total": [
        rf"(?:{VAT_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:итого|сервис|сто|$))",
    ],
    "grand_total": [
        r"Итого\s+по\s+акту\s+выполненных\s+работ\s*:?\s*\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})\s+(\d[\d\s]*(?:[.,]\d{2}))",
        r"Всего\s+по\s+наряд[- ]заказу:\s*\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})\s+(\d[\d\s]*(?:[.,]\d{2}))",
        r"Итого\s+по\s+заказ[- ]наряду\s*:?\s*\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})\s+(\d[\d\s]*(?:[.,]\d{2}))",
        r"Всего\s+к\s+оплате:\s*(\d[\d\s']*(?:[.,-]\d{2})?)",
        r"Итого\s+по\s+причине\s+обращения:\s*(\d[\d\s]*(?:[.,]\d{2})?)",
        rf"(?:{GRAND_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:сервис|сто|$))",
    ],
}
LINE_ITEM_PATTERN = re.compile(
    r"^(?P<name>[^\d].*?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>[A-Za-zА-Яа-я./-]{1,8}))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
PART_LINE_WITH_ARTICLE_PATTERN = re.compile(
    r"^(?P<article>[A-Za-zА-Яа-я0-9-]{3,})\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>[A-Za-zА-Яа-я./-]{1,8}))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
WORK_SECTION_MARKERS = ("работы", "услуги", "работа:")
PART_SECTION_MARKERS = ("запчасти", "материалы", "запчасть:")
SECTION_FOOTER_MARKERS = (
    "стоимость работ",
    "работы итого",
    "итого работ",
    "запчасти итого",
    "материалы итого",
    "стоимость запчастей",
    "стоимость материалов",
    "ндс",
    "итого к оплате",
    "к оплате",
    "всего",
    "сервис",
    "сто",
    "исполнитель",
    "подрядчик",
)
ITEM_UNIT_MARKERS = {
    "шт",
    "нч",
    "ч",
    "час",
    "часа",
    "часов",
    "компл",
    "усл",
    "ед",
    "л",
    "литр",
    "кг",
    "г",
    "гр",
    "мл",
    "м",
    "к-т",
}
AXB_WORK_NAME_KEYWORDS = (
    "то ",
    "то-",
    "техническое обслуживание",
    "подсоединение",
    "отсоединение",
    "диагност",
    "нормокомплект",
    "замена",
    "снятие",
    "свароч",
    "мойка",
    "поиск неисправности",
    "ремонт",
)
AXB_PART_NAME_KEYWORDS = (
    "фильтр",
    "фитинг",
    "соединитель",
    "головка",
    "шланг",
    "смазка",
    "амортизатор",
    "палм",
)
ARTICLE_TOKEN_PATTERN = re.compile(r"^(?=.*[\d-])[A-Za-zА-Яа-я0-9/_-]{3,}$")
AXB_ARTICLE_TOKEN_PATTERN = re.compile(r"^(?=.*[\d.-])[A-Za-zА-Яа-я0-9/._-]{3,}$")
WORK_CODE_TOKEN_PATTERN = re.compile(r"^(?=.*\d)(?=.*[A-Za-zА-Яа-я])[A-Za-zА-Яа-я0-9/_-]{3,}$")
TEXT_KEYWORD_PATTERN = re.compile(
    "|".join(
        [
            fuzzy_word_pattern("заказ"),
            fuzzy_word_pattern("наряд"),
            fuzzy_word_pattern("дата"),
            fuzzy_word_pattern("госномер"),
            fuzzy_word_pattern("пробег"),
            fuzzy_word_pattern("работ"),
            fuzzy_word_pattern("запчаст"),
            fuzzy_word_pattern("итого"),
            fuzzy_word_pattern("сервис"),
            fuzzy_word_pattern("ндс"),
        ]
    ),
    re.IGNORECASE,
)
TEXT_CHAR_REPLACEMENTS = str.maketrans(
    {
        "\xa0": " ",
        "¹": "№",
        "–": "-",
        "—": "-",
        "«": '"',
        "»": '"',
    }
)
SERVICE_NAME_BLOCKLIST = (
    "стоимость",
    "работ",
    "запчаст",
    "материал",
    "ндс",
    "итого",
    "к оплате",
    "пробег",
    "госномер",
    "заказ",
    "наряд",
    "дата",
)
OCR_RULE_TARGET_FIELDS = (
    "order_number",
    "repair_date",
    "mileage",
    "plate_number",
    "vin",
    "service_name",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
)
OCR_RULE_VALUE_PARSERS = {
    "raw",
    "date",
    "amount",
    "digits_int",
}
OCR_TOKEN_CHAR_REPLACEMENTS = str.maketrans(
    {
        "О": "O",
        "о": "o",
        "А": "A",
        "а": "a",
        "В": "B",
        "в": "b",
        "Е": "E",
        "е": "e",
        "К": "K",
        "к": "k",
        "М": "M",
        "м": "m",
        "Н": "H",
        "н": "h",
        "Р": "P",
        "р": "p",
        "С": "C",
        "с": "c",
        "Т": "T",
        "т": "t",
        "У": "Y",
        "у": "y",
        "Х": "X",
        "х": "x",
        "І": "I",
        "і": "i",
        "—": "-",
        "–": "-",
        "−": "-",
        "‑": "-",
    }
)
DEFAULT_OCR_PROFILE_MATCHER_DEFINITIONS: list[dict[str, object]] = [
    {
        "profile_scope": "axb",
        "title": "AXB Truck Service scanned order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"АХВ\s*Трак\s*Сервис",
        "service_name_pattern": None,
        "priority": 10,
    },
    {
        "profile_scope": "antares",
        "title": "Антарес order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"Антарес",
        "service_name_pattern": None,
        "priority": 20,
    },
    {
        "profile_scope": "gruzovye_rezervy",
        "title": "Грузовые резервы order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"ГРУЗОВЫЕ\s+РЕЗЕРВЫ|ГПТ?\d{6,}",
        "service_name_pattern": None,
        "priority": 30,
    },
    {
        "profile_scope": "ets_act",
        "title": "Енисей Трак Сервис work act",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"Енисей\s+Трак\s+Сервис[\s\S]{0,400}Акт\s+выполненных\s+работ",
        "service_name_pattern": None,
        "priority": 40,
    },
    {
        "profile_scope": "ets_invoice",
        "title": "Енисей Трак Сервис invoice",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"Енисей\s+Трак\s+Сервис[\s\S]{0,400}(?:СЧЕТ|Счет[- ]фактура)",
        "service_name_pattern": None,
        "priority": 50,
    },
    {
        "profile_scope": "leader_trak",
        "title": "ЛидерТрак order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"ЛидерТрак|НАРЯД-ЗАКАЗ",
        "service_name_pattern": None,
        "priority": 60,
    },
    {
        "profile_scope": "logistics",
        "title": "Логистика order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"ЛОГИСТИКА\",\s*ИНН|ЛОГИСТИКА\",\s*КПП",
        "service_name_pattern": None,
        "priority": 70,
    },
    {
        "profile_scope": "klever_trak",
        "title": "Клевер Трак XLSX order form",
        "source_type": "xlsx",
        "filename_pattern": None,
        "text_pattern": r"КЛЕВЕР\s+ТРАК|Заказ-наряд\s*№\s*КТ\d{6,}",
        "service_name_pattern": None,
        "priority": 75,
    },
    {
        "profile_scope": "sibtrakscan",
        "title": "СибТракСкан order form",
        "source_type": "pdf",
        "filename_pattern": None,
        "text_pattern": r"СИБТРАКСКАН|ЗСТ\d{6,}",
        "service_name_pattern": None,
        "priority": 80,
    },
]
PROFILE_SPECIFIC_OCR_RULE_DEFINITIONS: list[dict[str, object]] = [
    {"profile_scope": "axb", "target_field": "service_name", "pattern": r"(АХВ\s*Трак\s*Сервис)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "ets_act", "target_field": "service_name", "pattern": r"(Енисей\s*Трак\s*Сервис)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "ets_invoice", "target_field": "service_name", "pattern": r"(Енисей\s*Трак\s*Сервис)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "leader_trak", "target_field": "service_name", "pattern": r"(ЛидерТрак)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "leader_trak", "target_field": "order_number", "pattern": r"План\s+ремонта\s*№\s*([A-Za-zА-Яа-я0-9/_-]{3,})", "value_parser": "raw", "confidence": 0.97, "priority": 1},
    {"profile_scope": "leader_trak", "target_field": "order_number", "pattern": r"Предварительный\s+счет\s+на\s+оплату\s*№\s*([A-Za-zА-Яа-я0-9/_-]{3,})", "value_parser": "raw", "confidence": 0.92, "priority": 2},
    {"profile_scope": "klever_trak", "target_field": "service_name", "pattern": r"(КЛЕВЕР\s*ТРАК)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "sibtrakscan", "target_field": "service_name", "pattern": r"(СИБТРАКСКАН)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "gruzovye_rezervy", "target_field": "service_name", "pattern": r"(ГРУЗОВЫЕ\s+РЕЗЕРВЫ)", "value_parser": "raw", "confidence": 0.98, "priority": 1},
    {"profile_scope": "sibtrakscan", "target_field": "repair_date", "pattern": rf"(?:{DATE_CLOSED_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})", "value_parser": "date", "confidence": 0.96, "priority": 1},
    {"profile_scope": "sibtrakscan", "target_field": "repair_date", "pattern": rf"(?:{DATE_CLOSED_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})", "value_parser": "date", "confidence": 0.96, "priority": 2},
    {"profile_scope": "sibtrakscan", "target_field": "repair_date", "pattern": rf"(?:{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})", "value_parser": "date", "confidence": 0.92, "priority": 3},
    {"profile_scope": "sibtrakscan", "target_field": "repair_date", "pattern": rf"(?:{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})", "value_parser": "date", "confidence": 0.92, "priority": 4},
    {"profile_scope": "gruzovye_rezervy", "target_field": "repair_date", "pattern": r"(?:счет(?:\s+на\s+оплату)?)\s*[^\n\r]{0,120}?\bот\b\s*[:№]?\s*(\d{1,2}\s+[А-Яа-я]+\s+\d{4})", "value_parser": "date", "confidence": 0.97, "priority": 1},
    {"profile_scope": "gruzovye_rezervy", "target_field": "repair_date", "pattern": r"(?:счет(?:\s+на\s+оплату)?)\s*[^\n\r]{0,120}?\bот\b\s*[:№]?\s*(\d{2}[./-]\d{2}[./-]\d{2,4})", "value_parser": "date", "confidence": 0.97, "priority": 2},
    {"profile_scope": "gruzovye_rezervy", "target_field": "repair_date", "pattern": rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN})[^\n\r]{{0,120}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})", "value_parser": "date", "confidence": 0.96, "priority": 3},
    {"profile_scope": "gruzovye_rezervy", "target_field": "repair_date", "pattern": rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN})[^\n\r]{{0,120}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})", "value_parser": "date", "confidence": 0.96, "priority": 4},
]
UNIT_ALIASES = {
    "шт": "шт",
    "шг": "шт",
    "шt": "шт",
    "шт.": "шт",
    "ед": "ед",
    "ед.": "ед",
    "компл": "компл",
    "компл.": "компл",
    "к-т": "компл",
    "кт": "компл",
    "усл": "усл",
    "усл.": "усл",
    "л": "л",
    "л.": "л",
    "литр": "л",
    "литров": "л",
    "кг": "кг",
    "кг.": "кг",
    "г": "г",
    "гр": "г",
    "гр.": "г",
    "мл": "мл",
    "мл.": "мл",
    "м": "м",
    "м.": "м",
    "ч": "ч",
    "ч.": "ч",
    "час": "ч",
    "часа": "ч",
    "часов": "ч",
    "нч": "нч",
    "н.ч": "нч",
    "н/ч": "нч",
    "hч": "нч",
    "h.ч": "нч",
    "h/ч": "нч",
}
DEFAULT_OCR_RULE_DEFINITIONS: list[dict[str, object]] = [
    {"profile_scope": "default", "target_field": "order_number", "pattern": pattern, "value_parser": "raw", "confidence": 0.74, "priority": (index + 1) * 10}
    for index, pattern in enumerate(ORDER_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "repair_date", "pattern": pattern, "value_parser": "date", "confidence": 0.7, "priority": (index + 1) * 10}
    for index, pattern in enumerate(DATE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "mileage", "pattern": pattern, "value_parser": "digits_int", "confidence": 0.82, "priority": (index + 1) * 10}
    for index, pattern in enumerate(MILEAGE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "plate_number", "pattern": pattern, "value_parser": "raw", "confidence": 0.77, "priority": (index + 1) * 10}
    for index, pattern in enumerate(PLATE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "vin", "pattern": pattern, "value_parser": "raw", "confidence": 0.88, "priority": (index + 1) * 10}
    for index, pattern in enumerate(VIN_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "service_name", "pattern": pattern, "value_parser": "raw", "confidence": 0.58, "priority": (index + 1) * 10}
    for index, pattern in enumerate(SERVICE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": target_field, "pattern": pattern, "value_parser": "amount", "confidence": 0.8 if target_field == "grand_total" else 0.72, "priority": (index + 1) * 10}
    for target_field, patterns in TOTAL_PATTERNS.items()
    for index, pattern in enumerate(patterns)
] + PROFILE_SPECIFIC_OCR_RULE_DEFINITIONS
