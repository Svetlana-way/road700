from __future__ import annotations

import re


ETS_ACT_WORK_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<code>[A-Za-zА-Яа-я0-9.-]+)\s+"
    r"(?P<name>.+?)"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<norm>\d+(?:[.,]\d+)?)\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<total>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
ETS_ACT_PART_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<article>[A-Za-zА-Яа-я0-9.-]+)\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>[A-Za-zА-Яа-я./-]+)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<total>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
SIBTRAKSCAN_ROW_START_PATTERN = re.compile(r"^\d+\s+[A-Za-zА-Яа-я0-9/-]{2,}(?:\s|$)", re.IGNORECASE)
SIBTRAKSCAN_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<code>[A-Za-zА-Яа-я0-9/-]+)\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<unit>н/ч|шт|л|кг|м|компл|ед)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<total>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
LEADER_TRAK_ROW_START_PATTERN = re.compile(r"^\d+\s+\S+", re.IGNORECASE)
LEADER_TRAK_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>н/ч|шт|г|гр|мл|литр|л|кг|м)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<discount>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<gross>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
LEADER_TRAK_INVOICE_ROW_PATTERN = re.compile(
    r"(?P<row>\d{1,3})\s*"
    r"(?P<body>.+?)\s*"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>н/ч|шт|г|гр|мл|литр|л|кг|м)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2})?)\s+"
    r"(?P<discount>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<total>\d[\d\s]*(?:[.,]\d{2}))"
    r"(?=(?:\s*\d{1,3}\s*[A-Za-zА-Яа-яЁё№(]|Итого\s+RUB:|$))",
    re.IGNORECASE | re.DOTALL,
)
LOGISTICS_ROW_START_PATTERN = re.compile(r"^\d+\s+\S+", re.IGNORECASE)
LOGISTICS_WORK_TAIL_PATTERN = re.compile(
    r"^\d+(?:[.,]\d+)?\s+\d[\d\s]*(?:[.,]\d{2})\s+\d+(?:[.,]\d+)?\s+\d[\d\s]*(?:[.,]\d{0,2})?\s+\d+%\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})$",
    re.IGNORECASE,
)
LOGISTICS_PART_TAIL_PATTERN = re.compile(
    r"^\d+(?:[.,]\d+)?\s+[A-Za-zА-Яа-я./-]{1,8}\s+\d[\d\s]*(?:[.,]\d{2})\s+\d+%\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})$",
    re.IGNORECASE,
)
LOGISTICS_WORK_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<norm>\d+(?:[.,]\d+)?)\s+"
    r"(?P<rate>\d[\d\s]*(?:[.,]\d{0,2})?)\s+"
    r"\d+%\s+"
    r"(?P<gross>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
LOGISTICS_PART_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>[A-Za-zА-Яа-я./-]{1,8})\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"\d+%\s+"
    r"(?P<gross>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
KLEVER_TRAK_ROW_START_PATTERN = re.compile(r"^\d+\s+\S+", re.IGNORECASE)
KLEVER_TRAK_WORK_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{1,2})?)\s+"
    r"(?P<norm>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>н/?ч)\s+"
    r"(?P<gross>\d[\d\s]*(?:[.,]\d{1,2})?)\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{1,2})?)$",
    re.IGNORECASE,
)
KLEVER_TRAK_PART_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>[A-Za-zА-Яа-я./-]{1,8})\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{1,2})?)\s+"
    r"(?P<gross>\d[\d\s]*(?:[.,]\d{1,2})?)\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{1,2})?)$",
    re.IGNORECASE,
)
KLEVER_TRAK_VEHICLE_ROW_PATTERN = re.compile(
    r"(?:^|\n)\s*\d{2}\.\d{2}\.\d{4}\s+.+?\s+(?P<mileage>\d[\d\s]{2,})\s+"
    r"(?:нет|да)\s+(?P<vin>[A-HJ-NPR-Z0-9]{17})\s+(?P<plate>[А-ЯA-Z0-9 ]{6,16})(?=\s*(?:\n|$))",
    re.IGNORECASE,
)
ANTARES_ROW_START_PATTERN = re.compile(r"^\d+\s+\S+", re.IGNORECASE)
ANTARES_PART_TAIL_PATTERN = re.compile(
    r"^\d+(?:[.,]\d+)?\s+(?:шт\.?|кг|л|м|мл|г|гр|ед\.?|компл\.?|к-т)\b",
    re.IGNORECASE,
)
ANTARES_WORK_TAIL_PATTERN = re.compile(
    r"^\d+(?:[.,]\d+)?\s+\d[\d\s]*(?:[.,]\d{2})\b",
    re.IGNORECASE,
)
ANTARES_AMOUNT_CONTINUATION_PATTERN = re.compile(
    r"^\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})$",
    re.IGNORECASE,
)
ANTARES_PART_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>[A-Za-zА-Яа-я./-]{1,8})\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?:(?P<rate>\d+%)\s+)?"
    r"(?P<discount>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
ANTARES_WORK_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<norm>\d+(?:[.,]\d+)?)\s+"
    r"(?P<middle>.+?)\s+"
    r"(?:(?P<rate>\d+%)\s+)?"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<vat>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
GRUZOVYE_REZERVY_ROW_START_PATTERN = re.compile(r"^\d+\s+\S+", re.IGNORECASE)
GRUZOVYE_REZERVY_ROW_TAIL_PATTERN = re.compile(
    r"^\d+(?:[.,]\d+)?\s+[A-Za-zА-Яа-я./-]{1,8}\s+\d[\d\s]*(?:[.,]\d{2})\s+\d[\d\s]*(?:[.,]\d{2})$",
    re.IGNORECASE,
)
GRUZOVYE_REZERVY_ROW_PATTERN = re.compile(
    r"^\d+\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)\s+"
    r"(?P<unit>[A-Za-zА-Яа-я./-]{1,8})\s+"
    r"(?P<price>\d[\d\s]*(?:[.,]\d{2}))\s+"
    r"(?P<net>\d[\d\s]*(?:[.,]\d{2}))$",
    re.IGNORECASE,
)
