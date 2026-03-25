from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.enums import VehicleStatus, VehicleType
from app.models.vehicle import Vehicle
from app.services import document_processing


class DocumentParsingProfilesTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def test_load_active_ocr_profile_matchers_seeds_service_profiles(self) -> None:
        with self.SessionLocal() as db:
            matchers = document_processing.load_active_ocr_profile_matchers(db)

        profile_scopes = {item.profile_scope for item in matchers}
        self.assertIn("axb", profile_scopes)
        self.assertIn("ets_act", profile_scopes)
        self.assertIn("ets_invoice", profile_scopes)
        self.assertIn("gruzovye_rezervy", profile_scopes)
        self.assertIn("sibtrakscan", profile_scopes)

    def test_parse_document_text_prefers_full_labeled_service_name_for_axb_text(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "АХВ Трак
Сервис", ИНН 2466285228, КПП 246601001
Заказ-наряд № 0000019084 от 26.02.2025
Автомобиль : DFH4180 гос. номер: C113KX716 VIN: LGAG3DV2XP8837385 год вып. 2023 пробег 259 775
"""

        parsed = document_processing.parse_document_text(text, db=None)

        self.assertEqual(parsed["extracted_fields"]["service_name"], "ООО «АХВ Трак Сервис»")
        self.assertEqual(parsed["extracted_fields"]["order_number"], "0000019084")
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "C113KX716")
        self.assertEqual(parsed["extracted_fields"]["vin"], "LGAG3DV2XP8837385")
        self.assertEqual(parsed["extracted_fields"]["mileage"], 259775)

    def test_sanitize_extracted_items_removes_noise_work_names_but_keeps_real_work_rows(self) -> None:
        extracted_items = {
            "works": [
                {
                    "work_code": None,
                    "work_name": "1 н/ч",
                    "quantity": 1.0,
                    "unit_name": None,
                    "price": 799.64,
                    "line_total": 179.96,
                },
                {
                    "work_code": None,
                    "work_name": "356,33 1 976,00Итого RUB:",
                    "quantity": 18.0,
                    "unit_name": None,
                    "price": 624.23,
                    "line_total": 36.0,
                },
                {
                    "work_code": "24030632",
                    "work_name": "2 ШМ Колесо - смена (односкатное прицеп)",
                    "quantity": 1.0,
                    "unit_name": "нч",
                    "price": 1600.0,
                    "line_total": 1440.0,
                },
                {
                    "work_code": None,
                    "work_name": "ТО-2 (500 000)",
                    "quantity": 9.2,
                    "unit_name": "нч",
                    "price": 2343.48,
                    "line_total": 21559.97,
                },
            ],
            "parts": [],
        }

        sanitized_items, removed_count = document_processing.sanitize_extracted_items(extracted_items)

        self.assertEqual(removed_count, 2)
        self.assertEqual(len(sanitized_items["works"]), 2)
        self.assertEqual(
            [item["work_name"] for item in sanitized_items["works"]],
            ["2 ШМ Колесо - смена (односкатное прицеп)", "ТО-2 (500 000)"],
        )

    def test_parse_document_text_extracts_ets_act_vin_and_totals(self) -> None:
        text = (
            'ОФИЦИАЛЬНЫЙ ДИЛЕР VOLVO Общество с ограниченной ответственностью "Енисей Трак Сервис" '
            'Акт выполненных работ № 81121 от 03.03.2025 '
            'Модель автомобиля Гос. номер № шасси Пробег(м/ч) Состояние ЗН в валюте '
            'VOLVO FH13A 42T а477нх716 W1206671 450 320 Закрыт Руб '
            'Дата приема автомобиля: 03.03.2025 VIN Вид ремонта: Обслуживание X9PRG20A8JW120667 '
            'Итого работ: 3 3,30 10 150,00 2 030,00 12 180,00 '
            'Итого материалов: 2 52 559,67 10 511,93 63 071,60 '
            'Итого по акту выполненных работ : 62 709,67 12 541,93 75 251,60'
        )

        parsed = document_processing.parse_document_text(text, db=None)

        self.assertEqual(parsed["extracted_fields"]["order_number"], "81121")
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "А477НХ716")
        self.assertEqual(parsed["extracted_fields"]["vin"], "X9PRG20A8JW120667")
        self.assertEqual(parsed["extracted_fields"]["mileage"], 450320)
        self.assertEqual(parsed["extracted_fields"]["work_total"], 10150.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 52559.67)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 75251.6)

    def test_parse_document_text_extracts_ets_act_fields_from_late_scanned_block(self) -> None:
        text = """
ООО "Енисей Трак Сервис"
СЧЕТ Nº 431 от 03 Февраля 2025 г.
Счет-фактура Nº у00755 от 03 Февраля 2025 г.
Документ об отгрузке: у документу , N: акт выполненных работ е80381 от 03.02.25 г.
ОФИЦИАЛЬНЫЙ ДИЛЕР VOLVO
Общество с ограниченной ответственностью "Енисей Трак Сервис" ИНН: 2462033163
Акт выполненных работ Nº 80381 от 03.02.2025
Заказчик: ООО Транспортная компания "Семьсот дорог" ИНН: 1650251719
Модель автомобиля
Гос. номер
N шасси
VOLVO FH13A 42T
K350Bа716
W130676
Дата приема автомобиля:
02.02.2025
VIN
Вид ремонта:
Обслуживание
X9PRG20A0LW130676
Выполненные работы по акту выполненных работ Nº 80381
Пробег(м/ч)
1 089 300
Итого работ:
900,00
Расходная накладная к акту выполненных работ Nº 80381
Итого материалов:
300,00
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="ets_act")

        self.assertEqual(parsed["extracted_fields"]["order_number"], "80381")
        self.assertIn(parsed["extracted_fields"]["plate_number"], {"К350ВА716", "K350BА716"})
        self.assertEqual(parsed["extracted_fields"]["vin"], "X9PRG20A0LW130676")
        self.assertEqual(parsed["extracted_fields"]["mileage"], 1089300)
        self.assertNotIn("order_number_missing", parsed["manual_review_reasons"])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])

    def test_parse_document_text_extracts_reason_from_antares_header_block(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "Антарес"
Заказ-наряд № A0000022598 от 20.03.2026
Автомобиль : Volvo Truck, FH (4) гос. номер: K853AH716 VIN: X9PRG20A3MW137882 пробег 892 680
Причина обращения: Проведение БТО. Замена масла ДВС. Ремонт заднего правого крыла. Замена заднего правого фонаря.
Выполненные работы по заказ-наряду № A0000022598 от 20.03.2026 к причине обращения "Проведение БТО. Замена масла ДВС. Ремонт заднего правого крыла. Замена заднего правого фонаря."
№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Ставка НДС Всего в т.ч. НДС
7 86301-2 ЗАДНЕЕ КРЫЛО. ЗАМЕНА. 1 2 300,00 1,000 Ремонт узлов и агрег 22% 2 600,00 468,85
Расходная накладная к заказ-наряду № A0000022598 от 20.03.2026 к причине обращения "Проведение БТО. Замена масла ДВС. Ремонт заднего правого крыла. Замена заднего правого фонаря."
10 773-1926R-WE Задний фонарь правый, Depo 1 шт 4 346,78 22% 217,34 5 037,92 908,48
Итого материалов: 1 на сумму: 5 037,92 908,48
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="antares")

        self.assertEqual(
            parsed["extracted_fields"]["reason"],
            "Проведение БТО. Замена масла ДВС. Ремонт заднего правого крыла. Замена заднего правого фонаря.",
        )

    def test_parse_document_text_extracts_ets_act_line_items_from_compact_text_pdf(self) -> None:
        text = (
            'ОФИЦИАЛЬНЫЙ ДИЛЕР VOLVOОбщество с ограниченной ответственностью "Енисей Трак Сервис" '
            'Акт выполненных работ № 81121 от 03.03.2025 '
            'VOLVO FH13A 42T а477нх716W1206671 450 320 Закрыт Руб'
            'Дата приема автомобиля: 03.03.2025 VINВид ремонта: ОбслуживаниеX9PRG20A8JW120667'
            'Выполненные работы по акту выполненных работ № 81121'
            '№ Артикул Наименование Кол. оп.Цена н/чНорма СуммаСумма НДС, 20%Сумма с учетом НДС1 2 3 4 5 6 7 8 9'
            '1 17906-2 диагностика с использованием Tech Tool/GD. Подсоединение-отсоединение диагностического прибора включ1 3 500,00 0,50 1 750,00 350,00 2 100,00'
            '2 56000-0 проверка пневмосистемы 1 3 000,00 0,50 1 500,00 300,00 1 800,00'
            '3 26318-2 замена кольцо вентилятора охлаждения ДВС1 3 000,00 2,30 6 900,00 1 380,00 8 280,00'
            'Итого работ: 3 3,30 10 150,00 2 030,00 12 180,00'
            'Расходная накладная к акту выполненных работ № 81121'
            '№ Артикул Наименование Кол-во Ед.изм. Цена СуммаСумма НДС, 20%Сумма с учетом НДС1 2 3 4 5 6 7 8 9'
            '1 РМ расходные материалы 1 шт 300,00 300,00 60,00 360,00'
            '2 Н.7423754294 кольцо вентилятора (23754294) 1 шт 52 259,67 52 259,67 10 451,93 62 711,60'
            'Итого материалов:252 559,67 10 511,93 63 071,60'
            'Итого по акту выполненных работ :62 709,67 12 541,93 75 251,60'
        )

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="ets_act")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 3)
        self.assertEqual(len(parts), 2)
        self.assertEqual(works[0]["work_code"], "17906-2")
        self.assertEqual(works[0]["work_name"], "диагностика с использованием Tech Tool/GD. Подсоединение-отсоединение диагностического прибора включ")
        self.assertEqual(works[0]["quantity"], 1.0)
        self.assertEqual(works[0]["price"], 3500.0)
        self.assertEqual(works[0]["standard_hours"], 0.5)
        self.assertEqual(works[0]["line_total"], 1750.0)
        self.assertEqual(parts[1]["article"], "H7423754294")
        self.assertEqual(parts[1]["part_name"], "кольцо вентилятора (23754294)")
        self.assertEqual(parts[1]["quantity"], 1.0)
        self.assertEqual(parts[1]["price"], 52259.67)
        self.assertEqual(parts[1]["line_total"], 52259.67)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 52559.67)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 12541.93)

    def test_parse_document_text_extracts_ets_act_line_items_from_multiline_text_pdf(self) -> None:
        text = """
Акт выполненных работ № 84995 от 20.07.2025 с уч мойка
Модель автомобиля Гос. номер № шасси Пробег(м/ч) Состояние ЗН в валюте
VOLVO FH13A 42T а513се716 W120532 1 621 086 Закрыт Руб
Дата приема автомобиля: 19.07.2025 VIN
Вид ремонта: Обслуживание X9PRG20A7JW120532
Выполненные работы по акту выполненных работ № 84995
№ Артикул Наименование Кол. оп. Цена н/ч Норма Сумма Сумма НДС, 20% Сумма с учетом НДС
1 2 3 4 5 6 7 8 9
1 18203-2 мойка автомобиля 1 1 200,00 1,20 1 440,00 288,00 1 728,00
2 18200-0 мойка ДВС 1 1 200,00 0,70 840,00 168,00 1 008,00
3 17744-2 базовое ТО 1 3 000,00 1,20 3 600,00 720,00 4 320,00
4 17515-3 замена масло и фильтры масляные
ДВС
1 3 000,00 0,40 1 200,00 240,00 1 440,00
13 76245-2 замена стойка стабилизатора 2-я
ось лево
1 3 000,00 1,00 3 000,00 600,00 3 600,00
Итого работ: 13 6,70 17 030,00 3 406,00 20 436,00
Расходная накладная к акту выполненных работ № 84995
№ Артикул Наименование Кол-во Ед.изм. Цена Сумма Сумма НДС, 20% Сумма с учетом НДС
1 2 3 4 5 6 7 8 9
1 РМ расходные материалы 1 шт 300,00 300,00 60,00 360,00
2 Н.85102469 масло моторное swd rheinol favorol
10W40 Volvo VDS-3 (208л)
RHEINOL
37 л 602,81 22 303,91 4 460,78 26 764,69
8 Н.1161983 смазка 0,3 кг 1 387,50 416,25 83,25 499,50
13 Н.980464 хомут VOLVO 1 шт 21,58 21,58 4,32 25,90
Итого материалов: 58,3 56 109,96 11 221,99 67 331,95
Итого по акту выполненных работ : 73 139,96 14 627,99 87 767,95
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="ets_act")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertGreaterEqual(len(works), 5)
        self.assertGreaterEqual(len(parts), 4)
        self.assertTrue(any(item["work_code"] == "18203-2" and item["line_total"] == 1440.0 for item in works))
        self.assertTrue(any(item["work_code"] == "76245-2" and item["standard_hours"] == 1.0 for item in works))
        self.assertTrue(any(item["article"] == "H85102469" and item["quantity"] == 37.0 and item["unit_name"] == "л" for item in parts))
        self.assertTrue(any(item["article"] == "H1161983" and item["quantity"] == 0.3 and item["unit_name"] == "кг" for item in parts))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 17030.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 56109.96)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 14627.99)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 87767.95)

    def test_parse_document_text_extracts_ets_act_work_items_from_sparse_scanned_summary_block(self) -> None:
        text = """
Акт выполненных работ Nº 79605 от 06.01.2025
Заказчик: ООО Транспортная компания "Семьсот дорог" ИНН: 1650251719
Модель автомобиля
Гос. номер
Nº шасси
VOLVO FH13A 42T
a773Hp716
A816091
Дата приема автомобиля:
06.01.2025
VIN
Вид ремонта:
Обслуживание
YV2RG20A8JA816091
Выполненные работы по акту выполненных работ Nº 79605
Пробег (м/ч)
1 395 182
N
Артикул
Наименование
1
Кол. оп.
Цена
н/ч
4
5
1200,00
2 750,00
1 2 750,00
1 3 300,00
Норма
2
3
4
18200-0
56000-0
56100-2
17906-2
мойка автомобиля с прицепом
проверка пневмосистемы
ремонт воздушной трубки
диагностика с использованием Tech
Tool/GD.
Подсоединение-отсоединение
диагностического прибсоє включ
37102-3
электрические провода и разъемы,
1 3 300,00
проверка
6
33107-2
замена реле стартера тепловое
1 2 750,00
Итого работ:
6
Тринадцать тысяч сто шестьдесят четыре рубля 00 копеек в т.ч. НДС 2 194,00 Руб
3,00
0,50
0,50
0,50
0,40
0,60
5,50
Расходная накладная к акту выполненных работ Nº 79605
N
Артикул
Наименование
Кол-во
Ед.изм.
Цена
1
2
4
5
шт
ШТ
2
PM
H.SSM1000UL
расходные материалы
втягивающее реле стартера
(23504037) KRAUF
3
4
6
Н.БП00027744
H.10-16
RU3WUR08901000
RU3WUR089360
шланг (990424, 977650)
1
іхомут
спрей заморозка
0,3
ОЧИСТИТ.КОНТАКТОВ (0890100)
0,3
Итого материалов:
4,6
ШТ
ШТ
Шт
шт
Четыре тысячи девятьсот шестьдесят пять рублей 30 копеек в т.ч. НДС 827,54 Руб
6
300,00
2 566,67
379,17
38,50
1 666,67
1 178,07
VOLIO
с уч мойка
Состояние ЗН
Закрыт
в валюте
Руб
Сумма
T
3 600,00
1375,00
1375,00
1650,00
1 320,00
1 650,00
10 970,00
Сумма НДС,
20%
8
720,00
275,00
275,00
330,00
264,00
330,00
2 194,00
Сумма с учетом
НДС
9
4 320,00
1 650.00
1 650,00
1 980,00
1 584,00
1 980,00
13 164,00
Сумма
7
300,00
2 566,67
379,17
38,50
500,00
353,42
4 137,76
Сумма НДС,
20
8
60,00
513,33
75,83
7,70
100.00
70,68
827,54
Сумма с учетом
НДС
360.00đ
3 080.00
455,00
46,20
600,00
424,10
4 965,30
Сумма
15 107,76
Сумма НДС,
20%
3 021,54
Сумма с учетом
НДС
18 129,30
Итого по акту выполненных работ :
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="ets_act")
        works = parsed["extracted_items"]["works"]

        self.assertEqual(len(works), 6)
        self.assertTrue(any(item["work_code"] == "18200-0" and item["line_total"] == 3600.0 and item["standard_hours"] == 3.0 for item in works))
        self.assertTrue(any(item["work_code"] == "17906-2" and item["work_name"] == "диагностика с использованием Tech Tool/GD. Подсоединение-отсоединение диагностического прибсоє включ" for item in works))
        self.assertTrue(any(item["work_code"] == "37102-3" and item["line_total"] == 1320.0 for item in works))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 10970.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 4137.76)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 3021.54)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 18129.3)

    def test_parse_document_text_restores_ets_act_totals_from_invoice_summary_when_act_summary_is_sparse(self) -> None:
        text = """
СЧЕТ Nº 431 от 03 Февраля 2025 г.
Всего к оплате:
Сумма
168093-36
168093-36
33618-67
201712-03
Акт выполненных работ Nº 80381 от 03.02.2025
Модель автомобиля
Гос. номер
N шасси
VOLVO FH13A 42T
K350Bа716
W130676
Дата приема автомобиля:
02.02.2025
VIN
Вид ремонта:
Обслуживание
X9PRG20A0LW130676
Выполненные работы по акту выполненных работ Nº 80381
Пробег(м/ч)
1 089 300
Итого работ:
28
0,30l
900.00
0,30
900.00
2,20
6 600,00
1.00
3 500,00
0.20
700.00
1,60
4 800,00
0,50
1500,00
0,60 1 800,00
0,30
900,00
19,40]
57 940,00
Шестьдесят девять тысяч пятьсот двадцать восемь рублей 00 копеек в т.ч. НДС 11 588,00 Руб
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="ets_act")

        self.assertEqual(parsed["extracted_fields"]["work_total"], 57940.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 110153.36)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 33618.67)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 201712.03)

    def test_parse_document_text_extracts_axb_totals_from_profile_specific_blocks(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "АХВ Трак
Сервис", ИНН 2466285228
Заказ-наряд № 0000020577 от 02.05.2025
TC : ORTHAUS V3 гос. номер: BY167016, VIN: NPFCGSV30PA000038, год вып. 2023, пробег 296 723
Итого работ:
10,2
на сумму: 1 472,40
Всего
9
9 576,00
1 710,00
10 260,00
1 026,00
5 130,00
27 975,60
4 662,60
Расходная накладная к заказ-наряду № 0000020577 от 02.05.2025
Итого материалов:
71
на сумму: 2 057,40
39 090,60
6 515,10
Итого по причине обращения:
67 066,20 11 177,70
Итого по заказ-наряду :
67 066,20 11 177,70
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")

        self.assertEqual(parsed["extracted_fields"]["work_total"], 27975.6)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 39090.6)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 67066.2)

    def test_parse_document_text_derives_axb_parts_total_from_grand_total_when_material_block_is_noisy(self) -> None:
        text = """
Заказ-наряд № 0000020577 от 02.05.2025
TC : ORTHAUS V3 гос. номер: BY167016, VIN: NPFCGSV30PA000038, год вып. 2023, пробег 296 723
Итого работ:
10,2
Всего
9
9 576,00
1 710,00
10 260,00
1 026,00
5 130,00
27 975,60
4 662,60
Итого материалов:
71
на сумму: 2 057,40
Тридцать девять тысяч девяносто рублей 60 копеек в т.ч. НДС 6 515,10 RUB
Итого по заказ-наряду :
67 066,20 11 177,70
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")

        self.assertEqual(parsed["extracted_fields"]["work_total"], 27975.6)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 67066.2)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 39090.6)

    def test_parse_document_text_extracts_axb_invoice_items_from_payment_block(self) -> None:
        text = """
Заказ-наряд № 0000020577 от 02.05.2025
TC : ORTHAUS V3 гос. номер: BY167016, VIN: NPFCGSV30PA000038, год вып. 2023, пробег 296 723
Итого работ:
27 975,60
Итого материалов:
39 090,60
Итого по заказ-наряду :
67 066,20
Счет на оплату Nº 00000003018 от 02.05.2025
На основании: Заказ-наряд Nº 0000020577 от 02.05.2025
Автомобиль:
ORTHAUS V3 г/н BY167016 VIN: NPFCGSV30PA000038 ; пробег: 296 723
Nº
1
2
3
4
7
8
Товар
смазка медная, спрей, 210мл LAVR
Амортизатор подвески горизонтальный
320-475 20x78/20x68 ORTHAUS SAF
ТО прицепа.
Подсоединение/отсоединение
диагностического прибора
Нормокомплект
Амортизатор подвески замена
Запасное колесо, снятие
Сварочные работы
Артикул
Кол-во
LN1483
180-2905006-090
700700
17010-2
100
Ед.
1 шт
6 шт
2,8 F
0,5 -
0,08
3 -
0,3 -
1,5 -
Цена
348,00
6 800,00
3 600,00
3 600,00
3 600,00
3 600,00
3 600,00
3 600,00
Итого
RUB:
Скидка
17.40
2 040,00
504,00
90,00
14,40
540,00
54,00
270,00
3 529,80
в валюте:
в т.ч. НДС
55,10
6 460,00
1 596,00
285,00
45,60
1710,00
171,00
855,00
11 177,70
RUB
Всего
330,60
38 760,00
9 576,00
1 710,00
273,60
10 260,00
1 026,00
5 130,00
67 066,20
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 6)
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0]["article"], "LN1483")
        self.assertEqual(parts[0]["part_name"], "смазка медная, спрей, 210мл LAVR")
        self.assertEqual(parts[0]["quantity"], 1.0)
        self.assertEqual(parts[0]["price"], 348.0)
        self.assertEqual(parts[0]["line_total"], 330.6)
        self.assertEqual(works[0]["work_code"], "700700")
        self.assertEqual(works[0]["work_name"], "ТО прицепа.")
        self.assertEqual(works[0]["quantity"], 2.8)
        self.assertEqual(works[0]["price"], 3600.0)
        self.assertEqual(works[0]["line_total"], 9576.0)

    def test_parse_document_text_extracts_axb_invoice_items_from_multiline_invoice(self) -> None:
        text = """
Заказ-наряд № 0000019084 от 26.02.2025
Счет на оплату Nº 00000001275 от
26.02.2025
На основании: Заказ-наряд Nº 0000019084 от 26.02.2025
АвтомобильVIN: LGAG3DV2XP8837385
в валюте:
Nº
1
2
3
4
9
10
11
12
13
14
15
16
Товар
Фильтр топливный DF E-5 с
отСТОЙниКОМ
Фильтр топливный тонкой очистки
DF E-5
Фитинг прямой! D12х1,5мм
М16х1,5 под ключ 22мм WABCO
Соединитель угловой
M16x1,5/M16х1,54 в
пневмоподушку GRUNWALD Sirit
Головка соеденительная 22х1,5 с
фильтром желтая палм (прицеп)
Шланг перекидка восдушный
Фильтр топливный сепаратора
DongFeng
Мойка технологическая
седельного тягача
Мойка технологическая
полуприцепа
Нормокомплект
Поиск неисправности в
пневмосистеме
Топливный фильтр на стороне
нагнетания - Замена
Топливный фильтр на стороне
всасывания - Замена
Фильтрующий элемент
(топливного фильтра), замена.
Палм замена
Перекидка воздушная замена
Артикул
C4327369
Кол-во
C4365703
8938000022
Ед.
1 шт
1 шт
1 шт
Цена
6 768,00
2 520,00
588,00
Скидка
338,40
126,00
29,40
в т.ч. НДС
1 071,60
399,00
93,10
271051615
1 шт
540,00
27,00
85,50
35210140020
55520104
1125030-H02B0-
SFG
01
1 шт
1 шт
1 шт
0,6 ч
960,00
48,00
152,00
2 040,00
102,00
323.00
8 586,00
429,30
1 359,45
1 500,00
45,00
142,50
02
00
1 4
1 500,00
75,00
237,50
0,12 4
3 000,00
18,00
57,00
0,5 ч
3 000,00
75,00
237,50
11170102
0,5 ч
3 000,00
75,00
237,50
11170101
0,5 ч
3 000,00
75,00
237,50
11250301
0,7 4
3 000,00
105,00
332,50
0,3 4
3 000,00
, KРАRНА
0,54
45,00
142,50|
3 000,00
75,00
237,50
RUB
Всего
6 429,60
2 394,00
558,60
513,00
912,00
1 938,00
8 156,70
855,00
1 425,00
342,00
1 425,00
1 425,00
1 425,00
1995,00
855,00
1 425,00
32 073,90
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(parts), 7)
        self.assertEqual(len(works), 9)
        self.assertAlmostEqual(sum(item["line_total"] for item in parts), 20901.9, places=2)
        self.assertAlmostEqual(sum(item["line_total"] for item in works), 11172.0, places=2)
        self.assertTrue(any(item["work_name"] == "Мойка технологическая седельного тягача" and item["quantity"] == 0.6 for item in works))
        self.assertTrue(any(item["work_name"] == "Перекидка воздушная замена" and item["line_total"] == 1425.0 for item in works))
        self.assertTrue(any(item["part_name"] == "Фильтр топливный DF E-5 с отСТОЙниКОМ" and item["article"] == "C4327369" for item in parts))

    def test_parse_document_text_extracts_axb_invoice_items_without_explicit_invoice_title(self) -> None:
        text = """
Заказ-наряд № 0000018636 от 07.02.2025
Покупатель:
ТРАНСПОРТНАЯ КОМПАНИЯ "СЕМЬСОТ ДОРОГ"
По договору:
Продажа зіч и сервис в RUB от 22.05.23
На основании:
Заказ-наряд Nº 0000018636 от 07.02.2025
Автомобиль: NPFCGSV30PA000016
в валюте:
RUB
N
1
2
Товар
Датчик ABS SCHMITZ угл. Stellox
Термосоединитель проводов
красный 1.5-2.5 Stellox
Артикул
8550502SX
88-01400-SX
Кол-во Ед.
1 шт
2 шт
Цена
1 212,00
48,00
Итого RUB:
Скидка
60,60
4,80
Bcero
1 151,40
91,20
6 793,64
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0]["article"], "8550502SX")
        self.assertEqual(parts[0]["part_name"], "Датчик ABS SCHMITZ угл. Stellox")
        self.assertEqual(parts[0]["line_total"], 1151.4)
        self.assertEqual(parts[1]["article"], "88-01400-SX")
        self.assertEqual(parts[1]["quantity"], 2.0)
        self.assertEqual(parts[1]["price"], 48.0)

    def test_parse_document_text_extracts_axb_invoice_items_when_total_marker_uses_ocr_bcero(self) -> None:
        text = """
Заказ-наряд № 0000020428 от 26.04.2025
Счет на оплату Nº 00000002847 от 26.04.2025
На основании: Заказ-наряд Nº 0000020428 от 26.04.2025
Автомобиль: KOLUMAN S г/н BO015416 VIN: NLFS3010000057267 ; пробег: 148 985
в валюте:
Ng
2
4
Товар
Прокладка головки соединительной
пневматической, палм 17х41х9мм
ТО прицепа.
Артикул
095.010
700700
Кол-во
Ед.
1 шт
2,8 -
Цена
66,00
3 600,00
WRUB:
Скидка
3,30
504,00
Bcero
62,70
9 576,00
12 648,30
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(parts), 1)
        self.assertEqual(parts[0]["article"], "095010")
        self.assertEqual(parts[0]["line_total"], 62.7)
        self.assertEqual(len(works), 1)
        self.assertEqual(works[0]["work_code"], "700700")
        self.assertEqual(works[0]["quantity"], 2.8)
        self.assertEqual(works[0]["line_total"], 9576.0)

    def test_parse_document_text_extracts_axb_parts_from_material_section_without_invoice_block(self) -> None:
        text = """
Заказ-наряд № 0000019968 от 06.04.2025
Автомобиль : DFH4180 гос. номер: C320MT716 VIN: LGAG3DV20P8839078 год вып. 2023 пробег 250 000
Итого работ:
38 167,20
Итого материалов:
50 712,90
Расходная накладная к заказ-наряду Nº 0000019968 от 06.04.2025 к причине обращения "Прочее"
Артикул
3659445LLC
Наименование
МАСЛО Моторное лукоил
АВАНГАРД ПРОФЕССИОНАЛ LA
10W-40 (198л)Е6 бочка (2)
DFZPC4389022
Фильтр маслянный DF E5
3506911-91045*
Шланг тормозной к пневмокамере
Кол-во
40
1
1
Ед. изм. Цена
л/дмЗ 492,00
шт 6 060,00
шт 2 220,00
Bcero
18 696,00
5 757,00
4 427,00
Итого по странице материалов.
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[0]["article"], "3659445LLC")
        self.assertEqual(parts[0]["part_name"], "МАСЛО Моторное лукоил АВАНГАРД ПРОФЕССИОНАЛ LA 10W-40 (198л)Е6 бочка (2)")
        self.assertEqual(parts[0]["line_total"], 18696.0)
        self.assertEqual(parts[1]["article"], "DFZPC4389022")
        self.assertEqual(parts[2]["article"], "3506911-91045")

    def test_parse_document_text_restores_axb_totals_from_ocr_windows_around_markers(self) -> None:
        text = """
Заказ-наряд Nº 0000019968 от 06.04.2025
Автомобиль : DFH4180 гос. номер: C320MT716 VIN: LGAG3DV20P8839078 год вып. 2023 пробег 250 000
Итого работ:
8,4
на сумму: 2 008,80
Тридцать восемь тысяч сто шестьдесят семь рублей 20 копеек в т.ч. НДС 6 361,20 RUB
Bcero
38 167,20/
в т.ч. НДС
6 361,20
Итого материалов:
46
на сумму: 2 669,10
Пятьдесят тысяч семьсот двенадцать рублей 90 копеек в т.ч. НДС 8 452,15 RUB
Итого по причине обращения: IL
Всего по причине обращения: Восемьдесят восемь тысяч восемьсот восемьдесят рублей 10 копеек
Bcero
50 712,90/
8 452,15
88 880,10 14 813,35]
Заказ-наряд Nº 0000019968 от 06.04.2025
88 880,10 14 813,35
Итого по заказ-наряду : ||
Всего по заказ-наряду: Восемьдесят восемь тысяч восемьсот восемьдесят рублей 10 копеек в т.ч. НДС 14 813,35
RUB
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")

        self.assertEqual(parsed["extracted_fields"]["work_total"], 38167.2)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 50712.9)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 14813.35)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 88880.1)

    def test_parse_document_text_extracts_axb_items_from_sparse_ocr_sections(self) -> None:
        text = """
Заказ-наряд Nº 0000019968 от 06.04.2025
Автомобиль : DFH4180 гос. номер: C320MT716 VIN: LGAG3DV20P8839078 год вып. 2023 пробег 250 000
Выполненные работы по заказ-наряду Nº 0000019968 от 06.04.2025 к причине
обращения "Прочее"
N
Артикул
Наименование
Кол. оп.
Цена н/ч
Норма
1
н/ч
Скидка
2
3
4
1
5
6
7
0101
8
Мойка технологическая
З 600,00
седельного тягача
0,450l
Ремонт
81,00
2
Мойка технологическая
1
З 600,00
0,650
Ремонт
117,00
00
полуприцепа 13 метров
Нормокомплект
0,4
З 600,00
0,400
4
Ремонт
28,80
250000
TO-1 (250 000)
З 600,00
4,000
Ремонт
720,00
5
Ремень А/С
З 600,00
0,800
Ремонт
144,00
снятие/установка
6
Тормозной шланг,
1
замена
З 600,00
0,600
Ремонт
108,00
7
60131-3
Схождение колес,
регулировка
З 600,00
2,300 Ремонт
414,00
8
60108-2
Юстировка колес,
З 600,00
проверка
1,000 Ремонт
180,00
9
64300-2
Поперечная рулевая
тяга, замена
З 600,00
1,200 Ремонт
216,00
Итого работ:
8,4
на сумму: 2 008,80
Тридцать восемь тысяч сто шестьдесят семь рублей 20 копеек в т.ч. НДС 6 361,20 RUB
Bcero
9
1 539,00
2 223,00
547,20
13 680,00
2 736,000
2 052,00
7 866,00
3 420,00
4 104,00
38 167,20/
в т.ч. НДС
10
256,50
370,50
91,20
2 280,00
456,00l
342,00
1 311,000
570,00
684,00
6 361,20
No
1
1
2
3
Расходная накладная к заказ-наряду Nº 0000019968 от 06.04.2025 к причине
обращения "Прочее"
Артикул
2
3659445LLC
Наименование
МАСЛО Моторное лукоил
АВАНГАРД ПРОФЕССИОНАЛ LA
10W-40 (198л)Е6 бочка (2)
DFZPC4389022 Фильтр маслянный DF E5
3506911-91045* Шланг тормозной к пневмокамере
Кол-во
4
40
Ед. изм. Цена
1 Скидка
7
л/дмЗ 492,00
984,00
Bcero
18 696,00
Тв т. 4. НДС
3 116,00
Итого по странице материалов.
1
42
шт 6 060,00l
303,00
шт 2 220,00
111,00
на сумму:
1 398,00
5 757,00
г 109,00
26 562,00
959,50
351,50
4 427,00
Заказ-наряд Nº 0000019968 0m 06.04.2025
Расходная накладная к заказ-наряду N 0000019968 от 06.04.2025 к причине обращения:
Прочее
No
Артикул
Наименование
2
Коп-во / Едизм. Цена Скидка
LN3516
Очиститель тормозных дисков
шт 330,00
16.50
650мл Lavr
5
C5580038
Ремень поликлиновый
кондиционера DF E-5 6РK1591
6
3413050-H0100 Тяга рулевая поперечная в сборе
1
1
шт 1 980,00
99,00
Шт 22 536,0 1 126,80
7 LN3504
Многоцелевая смазка LV-40 650мл
шт 576,00
Итого по странице материалов:
на сумму: 1 271,10
Итого материалов:
46
на сумму: 2 669,10
Пятьдесят тысяч семьсот двенадцать рублей 90 копеек в т.ч. НДС 8 452,15 RUB
Итого по причине обращения: IL
Всего по причине обращения: Восемьдесят восемь тысяч восемьсот восемьдесят рублей 10 копеек
Страница: 2
Bcero
(в т.ч. НДС]
8
9
313,50
52.25
1 881,00
313,50K
21 409,20
3 568.20
547,20
91,20
24 150,90
4 025,15
50 712,90/
8 452,15
88 880,10 14 813,35]
Заказ-наряд Nº 0000019968 от 06.04.2025
88 880,10 14 813,35
Итого по заказ-наряду : ||
Всего по заказ-наряду: Восемьдесят восемь тысяч восемьсот восемьдесят рублей 10 копеек в т.ч. НДС 14 813,35
RUB
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="axb")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 9)
        self.assertEqual(len(parts), 5)
        self.assertAlmostEqual(sum(item["line_total"] for item in works), 38167.2, places=2)
        self.assertAlmostEqual(sum(item["line_total"] for item in parts), 50712.9, places=2)
        self.assertTrue(any(item["work_name"] == "Тормозной шланг, замена" and item["line_total"] == 2052.0 for item in works))
        self.assertTrue(any(item["work_code"] == "250000" and item["standard_hours"] == 4.0 and item["price"] == 3600.0 for item in works))
        self.assertTrue(any(item["work_code"] == "60131-3" and item["standard_hours"] == 2.3 for item in works))
        self.assertTrue(any(item["work_code"] == "64300-2" and item["standard_hours"] == 1.2 for item in works))
        self.assertTrue(any(item["article"] == "LN3504" and item["line_total"] == 547.2 for item in parts))
        self.assertTrue(any("МАСЛО Моторное лукоил" in item["part_name"] and "Шланг тормозной" in item["part_name"] for item in parts))

    def test_parse_document_text_extracts_antares_items_from_multiline_sections(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "Антарес"
Заказ-наряд № A0000018822 от 28.03.2025
Автомобиль : FH (4) гос. номер: K104CO716 VIN: X9PRG20A7MW139201 год вып. 2021 пробег 780 340
Выполненные работы по заказ-наряду № A0000018822 от 28.03.2025 к причине обращения "Проведение БТО дубль"
№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9
1 17744-2 Базовое Техническое
Обслуживание
1 2 300,00 1,200 Ремонт
узлов и
агрег
3 312,00 552,00
2 17515-3 ДВИГАТЕЛЬ. МАСЛО И ФИЛЬТР .
ЗАМЕНА.
1 2 300,00 0,400 Ремонт
узлов и
агрег
1 104,00 184,00
13 21000-2 Чистка блока ДВС 1 2 300,00 1,000 Ремонт
узлов и
агрег
2 760,00 460,00
Итого по странице материалов: 2 на сумму: 12 420,00 2 070,00
Итого работ: 13 на сумму: 37 536,00 6 256,00
Расходная накладная к заказ-наряду № A0000018822 от 28.03.2025 к причине обращения "Проведение БТО дубль"
№ Артикул Наименование Кол-во Ед.изм. Цена Скидка Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9
1 H200WN01 (K) Фильтр масляный, HENGST 1 шт 2 104,70 378,85 2 146,79 357,80
2 H328WK (K) Фильтр топливный сепаратора,
HENGST
1 шт 4 904,25 882,77 5 002,33 833,72
5 153852 Масло моторное Mobil Delvac MX
ESP 10W-30
39 л 525,44 0,00 24 590,59 4 098,43
6 AC22201616 Маслозаливная горловина 1 шт 11 969,8
1
718,19 13 645,58 2 274,26
16 4640076016268 Смазка Графитная Нефтесинтез 0,8
кг
0,3 кг 237,38 0,00 85,45 14,24
18 2609000 Прокладка маслопровода турбины
Lema
1 шт 67,11 0,00 80,53 13,42
Итого материалов: 62,3 на сумму: 5 740,69 101 475,69 16 912,59
Итого по причине обращения: 139 011,69 23 168,59
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="antares")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 3)
        self.assertEqual(len(parts), 6)
        self.assertTrue(any(item["work_code"] == "17744-2" and item["standard_hours"] == 1.2 and item["line_total"] == 3312.0 for item in works))
        self.assertTrue(any(item["work_code"] == "21000-2" and item["work_name"] == "Чистка блока ДВС" for item in works))
        self.assertTrue(any(item["article"] == "H328WK" and item["part_name"] == "(K) Фильтр топливный сепаратора, HENGST" for item in parts))
        self.assertTrue(any(item["article"] == "AC22201616" and item["price"] == 11969.81 and item["line_total"] == 13645.58 for item in parts))
        self.assertTrue(any(item["article"] == "4640076016268" and item["quantity"] == 0.3 and item["unit_name"] == "кг" for item in parts))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 37536.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 101475.69)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 23168.59)
        self.assertIn("antares_items_restored_from_tabular_sections", parsed["normalization_notes"])

    def test_parse_document_text_extracts_antares_items_with_vat_rate_column(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "Антарес"
Заказ-наряд № A0000021909 от 22.01.2026
Автомобиль : Volvo Truck, FH (4) гос. номер: K035CO716 VIN: X9PRG20A7MW139215 пробег 875 597
Выполненные работы по заказ-наряду № A0000021909 от 22.01.2026 к причине обращения "Ремонт задних крыльев"
№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9 10
1 18101-2 Мойка грузового
автомобиля/автобуса
1 2 131,15 1,000 Ремонт узлов
и агрег
22% 2 600,00 468,85
2 17906-2 Диагностика с
использованием Tech Tool/GD.
Подсоединение-отсоедине
ние диагнос.прибора вклю
1 2 300,00 0,500 Ремонт узлов
и агрег
22% 1 403,00 253,00
13 37100-2 Кабели. Ремонт
электропроводки
1 2 300,00 2,500 Ремонт узлов
и агрег
22% 7 015,00 1 265,00
Итого работ: 14 на сумму: 42 164,60 7 603,45
Расходная накладная к заказ-наряду № A0000021909 от 22.01.2026 к причине обращения "Ремонт задних крыльев"
№ Артикул Наименование Кол-во Ед.изм. Цена Ставка НДС Скидка Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9 10
1 773-1926R-WE Задний фонарь правый,
Depo
1 шт 4 346,78 22% 217,34 5 037,92 908,48
10 RU3008901087
30
Очиститель-обезжиривате
ль (500мл)
1 шт 307,48 22% 0,00 375,13 67,65
22 1987302501_B
CH
Лампа P21W 24V 4 шт 90,30 22% 0,00 440,66 79,46
24 8GA002071241 Лампа 24V 4 шт 56,87 22% 0,00 277,53 50,05
Итого материалов: 63 на сумму: 2 713,15 68 227,01 12 303,24
Итого по причине обращения: 110 391,61 19 906,69
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="antares")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 3)
        self.assertEqual(len(parts), 4)
        self.assertTrue(any(item["work_code"] == "18101-2" and item["price"] == 2131.15 and item["line_total"] == 2600.0 for item in works))
        self.assertTrue(any(item["work_code"] == "37100-2" and item["standard_hours"] == 2.5 for item in works))
        self.assertTrue(any(item["article"] == "773-1926R-WE" and item["part_name"] == "Задний фонарь правый, Depo" for item in parts))
        self.assertTrue(any(item["article"] == "RU300890108730" and "Очиститель-обезжиривате" in item["part_name"] for item in parts))
        self.assertTrue(any(item["article"] == "1987302501_BCH" and item["quantity"] == 4.0 and item["line_total"] == 440.66 for item in parts))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 42164.6)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 68227.01)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 19906.69)

    def test_parse_document_text_extracts_sibtrakscan_totals_from_summary_block(self) -> None:
        text = """
Общество с ограниченной ответственностью "СИБТРАКСКАН"
ЗАКАЗ-НАРЯД № ЗСТ26002072
Дата открытия 05.03.2026 г.
Дата начала работ: 09.03.2026
Дата окончания работ: 09.03.2026
Дата закрытия 09.03.2026 г.
ТРАНСПОРТНОЕ СРЕДСТВО
Марка: Dongfeng Модель: Dongfeng DFH4180 Гос. ном. знак: С026ВВ716
Год выпуска: 2023 № шасси: P8834073 № двиг.: 93969613 Пробег: 639 889
ЗАДАНИЕ: 1,Мойка
1 N00008102-0 Мойка автопоезда н/ч 0,84 3 675,00 3 087,00 679,14 3 766,14
Итого по заданию № 1 : 3 766,14
Итого нормочасов: 7,64
Всего по работам[СНДС]: 28 654,14
Всего по материалам[СНДС]: 107 494,20
Всего: 136 148,34
в т.ч. НДС: 24 551,34
Итого по заказ-наряду № ЗСТ26002072: сумма без НДС 111 597, сумма НДС 24 551,34, всего с НДС 136 148,34 руб.
К оплате: 136 148,34
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="sibtrakscan")

        self.assertEqual(parsed["extracted_fields"]["work_total"], 28654.14)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 107494.2)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 136148.34)
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 24551.34)

    def test_parse_document_text_extracts_sibtrakscan_items_from_task_sections(self) -> None:
        text = """
Общество с ограниченной ответственностью "СИБТРАКСКАН"
ЗАКАЗ-НАРЯД № ЗСТ26002072
Дата открытия 05.03.2026 г.
Дата начала работ: 09.03.2026
Дата окончания работ: 09.03.2026
Дата закрытия 09.03.2026 г.
ТРАНСПОРТНОЕ СРЕДСТВО
Марка: Dongfeng Модель: Dongfeng DFH4180 Гос. ном. знак: С026ВВ716
Год выпуска: 2023 № шасси: P8834073 № двиг.: 93969613 Пробег: 639 889
ЗАДАНИЕ: 3,Замена модулятора прицепа
1 35222101 Диагностика неисправностей и замена узла
клапана прицепа н/ч 1,5 3 000,00 4 500,00 990,00 5 490,00
2 3522210-91000 Клапан прицепа в сборе-EBS шт 1 41 800,00 41 800,00 9 196,00 50 996,00
Итого по заданию № 3 : 56 486,00
ЗАДАНИЕ: 4,Замена датчика АБС 1R
1 35500501
Диагностика неисправности и замена
датчика скорости вращения колеса в
сборе-передний тормоз
н/ч 1,6
3 000,00 4 800,00 1 056,00 5 856,00
2 YGS1027 Хомут пластиковый 350х8 мм; черный
(815363) шт 14 30,00 420,00 92,40 512,40
3 3550050-H03R0 Датчик скорости вращения колеса, задний шт 1 3 789,00 3 789,00 833,58 4 622,58
Итого по заданию № 4 : 10 990,98
Итого нормочасов: 7,64
Всего по работам[СНДС]: 28 654,14
Всего по материалам[СНДС]: 107 494,20
Всего: 136 148,34
в т.ч. НДС: 24 551,34
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="sibtrakscan")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 2)
        self.assertEqual(len(parts), 3)
        self.assertEqual(works[0]["work_code"], "35222101")
        self.assertEqual(works[0]["quantity"], 1.5)
        self.assertEqual(works[0]["unit_name"], "нч")
        self.assertEqual(works[0]["line_total"], 4500.0)
        self.assertTrue(any(item["article"] == "3522210-91000" and item["line_total"] == 41800.0 for item in parts))
        self.assertTrue(any(item["article"] == "YGS1027" and item["quantity"] == 14.0 for item in parts))
        self.assertTrue(any(item["article"] == "3550050-H03R0" and item["price"] == 3789.0 for item in parts))

    def test_parse_document_text_enriches_sibtrakscan_vin_from_vehicle_registry(self) -> None:
        text = """
Общество с ограниченной ответственностью "СИБТРАКСКАН"
ЗАКАЗ-НАРЯД № ЗСТ26002072
Дата открытия 05.03.2026 г.
Дата начала работ: 09.03.2026
Дата закрытия 09.03.2026 г.
ТРАНСПОРТНОЕ СРЕДСТВО
Марка: Dongfeng Модель: Dongfeng DFH4180 Гос. ном. знак: С026ВВ716
Год выпуска: 2023 № шасси: P8834073 № двиг.: 93969613 Пробег: 639 889
"""

        with self.SessionLocal() as db:
            db.add(
                Vehicle(
                    external_id="sibtrakscan-plate-match",
                    vehicle_type=VehicleType.TRUCK,
                    status=VehicleStatus.ACTIVE,
                    plate_number="с026вв/716",
                    vin="LGAG3DV29P8834073",
                    brand="Dongfeng",
                    model="Dongfeng DFH4180",
                )
            )
            db.commit()

            parsed = document_processing.parse_document_text(text, db=db, profile_scope="sibtrakscan")

        self.assertEqual(parsed["extracted_fields"]["plate_number"], "С026ВВ716")
        self.assertEqual(parsed["extracted_fields"]["vin"], "LGAG3DV29P8834073")
        self.assertIn("VIN дополнен по совпадению с реестром техники.", parsed["normalization_notes"])

    def test_parse_document_text_prefers_sibtrakscan_close_date_with_db_rules(self) -> None:
        text = """
Общество с ограниченной ответственностью "СИБТРАКСКАН"
ЗАКАЗ-НАРЯД № ЗСТ26001637
Дата открытия 19.02.2026 г.
Дата начала работ: 19.02.2026
Дата окончания работ: 22.02.2026
Дата закрытия 22.02.2026 г.
ТРАНСПОРТНОЕ СРЕДСТВО
Марка: Dongfeng Модель: Dongfeng DFH4180 Гос. ном. знак: С469АС716
Год выпуска: 2023 № шасси: P8834102 № двиг.: 93970029 Пробег: 506 884
"""

        with self.SessionLocal() as db:
            parsed = document_processing.parse_document_text(text, db=db, profile_scope="sibtrakscan")

        self.assertEqual(parsed["extracted_fields"]["repair_date"], "2026-02-22")

    def test_parse_document_text_prefers_gruzovye_rezervy_order_date_with_db_rules(self) -> None:
        text = """
Заказ-наряд № ГП000220663 от 10 марта 2026 г.
Предварительный заказ-наряд № ГП000026502 от 09 марта 2026 г.
Исполнитель:Общество с ограниченной ответственностью
"ГРУЗОВЫЕ РЕЗЕРВЫ", ИНН 5504139628
Шасси:Schmitz, SKO, 24
VIN:WSM00000005208662 г/н: вв 0473 16
Заказчик: ООО ТК "Семьсот дорог", ИНН 1650251719 Год выпуска: 2018 Пробег: -
Дата монтажа: 20.06.18
"""

        with self.SessionLocal() as db:
            parsed = document_processing.parse_document_text(text, db=db, profile_scope="gruzovye_rezervy")

        self.assertEqual(parsed["extracted_fields"]["repair_date"], "2026-03-10")

    def test_parse_document_text_prefers_gruzovye_rezervy_invoice_date_over_signature_date_with_db_rules(self) -> None:
        text = """
Счет на оплату № ГП000002278 от 09 января 2026 г.
Поставщик:
Общество с ограниченной ответственностью "ГРУЗОВЫЕ РЕЗЕРВЫ"
г/н: с 168 мк
Документ подписан и передан через оператора ЭДО АО "ПФ "СКБ Контур"
Дата и время подписания
12.01.2026 09:30 GMT+03:00
"""

        with self.SessionLocal() as db:
            parsed = document_processing.parse_document_text(text, db=db, profile_scope="gruzovye_rezervy")

        self.assertEqual(parsed["extracted_fields"]["repair_date"], "2026-01-09")

    def test_parse_document_text_extracts_leader_trak_mixed_table_items(self) -> None:
        text = """
Общество с ограниченной ответственностью "ЛидерТрак"
НАРЯД-ЗАКАЗ № ЛТ250004899 от 12.05.2025
Автомобиль:
DFH4180, гос. номер: 831ОТТ716, шасси: LGAG3DV22P8830897, VIN: LGAG3DV22P8830897, пробег:
416 695, год выпуска 2022, цвет Синий
Выполненные сервисные услуги и использованные материалы
№ Номер
операции или
запчасти
Наименование работ,
запчастей и материалов
Кол-во Ед.
измер.
Цена за
единицу
Сумма
скидки
Стоимость
без налога
Сумма
налога
Стоимость
с налогом *
1 ЧМЗ902802MS-2902012-10Рессора передняя 2 шт 44 535,65 10 688,56 80 164,17 16 032,83 96 197,00
2 Мойка №2 Мойка портальная, ручная
,(автопоезд 16 м. п/п) 0,8 н/ч 2 223,38 213,44 1 600,83 320,17 1 921,00
3 43215045 Рессора - смена 6 н/ч 1 988,89 1 432,00 10 740,00 2 148,00 12 888,00
4 72000-2
Рессоры, общие сведения.
Номер вспомогательной
операции
2 н/ч 1 988,89 477,33 3 580,00 716,00 4 296,00
5 ЦБ00003120 подгонка рессор 6 н/ч 2 000,00 1 440,00 10 800,00 2 160,00 12 960,00
6 Индукция. слесарные работы. 1 н/ч 2 000,00 240,00 1 800,00 360,00 2 160,00
Всего по странице: 108 685,00 21 737,00 130 422,00
Всего по наряд-заказу: 108 685,00 21 737,00 130 422,00
Всего: 130 422,00 рублей, включая НДС 21 737,00рублей.
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="leader_trak")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 5)
        self.assertEqual(len(parts), 1)
        self.assertTrue(str(parts[0]["article"]).endswith("902802MS-2902012-10"))
        self.assertEqual(parts[0]["part_name"], "Рессора передняя")
        self.assertEqual(parts[0]["quantity"], 2.0)
        self.assertEqual(parts[0]["line_total"], 80164.17)
        self.assertTrue(any(item["work_code"] == "43215045" and item["line_total"] == 10740.0 for item in works))
        self.assertTrue(any(item["work_code"] == "72000-2" and item["standard_hours"] == 2.0 for item in works))
        self.assertTrue(any(item["work_name"] == "Индукция. слесарные работы." and item["line_total"] == 1800.0 for item in works))
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 21737.0)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 130422.0)
        self.assertAlmostEqual(parsed["extracted_fields"]["work_total"], 28520.83, places=2)
        self.assertAlmostEqual(parsed["extracted_fields"]["parts_total"], 80164.17, places=2)

    def test_parse_document_text_extracts_leader_trak_items_across_pages(self) -> None:
        text = """
Общество с ограниченной ответственностью "ЛидерТрак"
НАРЯД-ЗАКАЗ № ЛТ250002311 от 28.02.2025
Автомобиль:
DFH4180, гос. номер: 091СЕМ716, шасси: P8834744, VIN: LGAG3DV28P8834744, пробег: 229 142
Выполненные сервисные услуги и использованные материалы
16 Мойка №2 Мойка портальная, ручная
,(автопоезд 16 м. п/п) 0,8 н/ч 2 200,24 211,22 1 584,17 316,83 1 901,00
17 26006-2
СИСТЕМА ОХЛАЖДЕНИЯ.
ТЕСТИРОВАНИЕ ПОД
ДАВЛЕНИЕМ.
0,7 н/ч 2 000,00 168,00 1 260,00 252,00 1 512,00
18 Инспекционный осмотр (Тягач) 2 н/ч 2 000,00 480,00 3 600,00 720,00 4 320,00
Всего по странице: 56 626,68 11 325,32 67 952,00
Страница 1 из 4
Передан через Диадок 03.03.2025 13:54 GMT+03:00
a9d6fd9b-203c-4ef9-8a13-c892beb08927
19 17906-2 Диагностика GD 1,5 н/ч 2 300,00 414,00 3 105,00 621,00 3 726,00
20 закрепить 1 н/ч 2 000,00 240,00 1 800,00 360,00 2 160,00
21 81100101
Диагностика неисправностей и
замена узла кондиционирования
воздуха
8 н/ч 2 000,00 1 920,00 14 400,00 2 880,00 17 280,00
Всего по странице: 56 626,68 11 325,32 67 952,00
Всего по наряд-заказу: 152 765,86 30 553,14 183 319,00
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="leader_trak")
        works = parsed["extracted_items"]["works"]

        self.assertEqual(len(works), 6)
        self.assertTrue(any(item["work_code"] == "26006-2" and item["line_total"] == 1260.0 for item in works))
        self.assertTrue(any(item["work_name"] == "Инспекционный осмотр (Тягач)" and item["line_total"] == 3600.0 for item in works))
        self.assertTrue(any(item["work_code"] == "81100101" and item["standard_hours"] == 8.0 for item in works))
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 30553.14)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 183319.0)

    def test_parse_document_text_prefers_leader_trak_profile_rows_when_generic_items_miss_work_section(self) -> None:
        text = """
Общество с ограниченной ответственностью "ЛидерТрак"
НАРЯД-ЗАКАЗ № ЛТ250012346 от 26.12.2025
Автомобиль:
914296-04, гос. номер: 7745ВУ16, шасси: P0000575, VIN: XJY914296P0000575, пробег: 1
Выполненные сервисные услуги и использованные материалы
№ Номер
операции или
запчасти
Наименование работ,
запчастей и материалов
Кол-во Ед.
измер.
Цена за
единицу
Сумма
скидки
Стоимость
без налога
Сумма
налога
Стоимость
с налогом *
1 ZZ5555 Расходные материалы (шиномонтаж) 1 шт 109,17 0,00 109,17 21,83 131,00
2 2 ШМ Колесо - смена (односкатное прицеп) 1 н/ч 1 600,00 192,00 1 440,00 288,00 1 728,00
3 5 ШМ Перебортовка колеса 1,4 н/ч 1 599,86 268,78 2 015,83 403,17 2 419,00
4 24030632 Замена шпилек полуоси (задняя ось) 3 н/ч 1 600,00 576,00 4 320,00 864,00 5 184,00
Всего по странице: 7 885,00 1 577,00 9 462,00
Всего по наряд-заказу: 7 885,00 1 577,00 9 462,00
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="leader_trak")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 3)
        self.assertEqual(len(parts), 1)
        self.assertTrue(any(item["work_name"] == "2 ШМ Колесо - смена (односкатное прицеп)" and item["line_total"] == 1440.0 for item in works))
        self.assertTrue(any(item["work_name"] == "5 ШМ Перебортовка колеса" and item["standard_hours"] == 1.4 for item in works))
        self.assertTrue(any(item["work_code"] == "24030632" and item["line_total"] == 4320.0 for item in works))
        self.assertEqual(parts[0]["article"], "ZZ5555")
        self.assertEqual(parts[0]["line_total"], 109.17)
        self.assertAlmostEqual(parsed["extracted_fields"]["work_total"], 7775.83, places=2)
        self.assertAlmostEqual(parsed["extracted_fields"]["parts_total"], 109.17, places=2)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 9462.0)

    def test_parse_document_text_extracts_gruzovye_rezervy_items_from_sections(self) -> None:
        text = """
Заказ-наряд № ГП000215622 от 12 февраля 2026 г.
Исполнитель: Общество с ограниченной ответственностью "ГРУЗОВЫЕ РЕЗЕРВЫ"
VIN: LGAG3DV22P8837316 г/н: с 163 мк 716
Заказчик: ООО ТК "Семьсот дорог" Год выпуска: 2023 Пробег: 462501
№ Наименование работ, услуг Кол-во Ед. Цена Сумма
Виды Работ:
1 Подключение диагностического прибора 1 шт. 620,00 620,00
2 Коды неисправностей - Считывание 1 шт. 3 100,00 3 100,00
3 Датчик давления воздуха 3-го контура, ДиЗ 1 шт. 3 100,00 3 100,00
4 Тормозная система (вед. ось) - диагностика справа 1 шт. 2 480,00 2 480,00
5 Тормозная система (перед. ось) - диагностика слева 1 шт. 2 170,00 2 170,00
6 Пневмосистема - соединительный шланг, ДиЗ передняя ось слева 2 шт. 1 550,00 3 100,00
7 Двигатель - диагностика натяжителей и ремней 1 шт. 1 550,00 1 550,00
8 Натяжитель ремня кондиционера, ДиЗ 1 шт. 3 100,00 3 100,00
9 Генератор, ДиЗ 1 шт. 3 100,00 3 100,00
10 Пневмосистема - устранение утечек воздуха трубки КПП 1 шт. 1 550,00 1 550,00
11 Автономный отопитель - воздуховод, Ремонт 1 шт. 1 550,00 1 550,00
25 420,00 руб.
Материалы:
12 генератор ! \\Dongfeng евро5 1 шт 63 939,00 63 939,00
13 гофра воздушная !d90mm \\EBERSPECHER 0,5 м 2 996,00 1 498,00
14 датчик давления воздуха ! \\Dongfeng 1 шт 1 689,00 1 689,00
15 натяжитель ремня кондиционера в сборе!\\ Dongfeng 1 шт 6 440,00 6 440,00
16 соединитель прямой! D12 2 шт 824,00 1 648,00
17 фитинг переходник автомат Т-образный 1 шт 1 550,00 1 550,00
18 хомут пластиковый 370 х 7,6 10 шт 11,00 110,00
19 хомут пластмассовый черный нейлон 4,8х360 9 шт 7,00 63,00
20 шланг соединительный пневмосистемы!M12, L=650mm\\VOLVO FH/FM 2 шт 1 671,00 3 342,00
80 279,00 руб.
Итого: 105 699,00
В том числе НДС 19 060,49
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="gruzovye_rezervy")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 11)
        self.assertEqual(len(parts), 9)
        self.assertTrue(any(item["work_name"] == "Подключение диагностического прибора" and item["line_total"] == 620.0 for item in works))
        self.assertTrue(any(item["work_name"] == "Пневмосистема - соединительный шланг, ДиЗ передняя ось слева" and item["quantity"] == 2.0 for item in works))
        self.assertTrue(any(item["part_name"] == "генератор ! \\Dongfeng евро5" and item["price"] == 63939.0 for item in parts))
        self.assertTrue(any(item["part_name"] == "гофра воздушная !d90mm \\EBERSPECHER" and item["quantity"] == 0.5 and item["unit_name"] == "м" for item in parts))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 25420.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 80279.0)

    def test_parse_document_text_extracts_gruzovye_rezervy_multiline_rows(self) -> None:
        text = """
Заказ-наряд № ГП000210722 от 19 января 2026 г.
Исполнитель: Общество с ограниченной ответственностью "ГРУЗОВЫЕ РЕЗЕРВЫ"
VIN: NLS3DFFSTP1064773 г/н: ву 2965 16
Заказчик: ООО ТК "Семьсот дорог" Год выпуска: 2023 Пробег: -
№ Наименование работ, услуг Кол-во Ед. Цена Сумма
Виды Работ:
1 Дисковый тормозной суппорт, Диагностика средняя ось слева 1 шт. 2 175,00 2 175,00
2 Дисковый тормозной суппорт, Д/М 5 шт. (кроме средней оси слева) 5 шт. 2 900,00 14 500,00
3 Дисковый тормозной суппорт, Ремонт (полный) 5 шт. (кроме средней оси
слева)
5 шт. 5 800,00 29 000,00
4 Токарные работы - изготовление заглушки тормозного суппорта 1 шт. 1 740,00 1 740,00
5 Рычаг подвески - пластина изнашивания, ДиЗ 3 оси 12 шт 3 шт. 2 900,00 8 700,00
6 Оси п/прицепа - проверка соосности, регулировка 3 шт. 4 350,00 13 050,00
69 165,00 руб.
Материалы:
7 гайка !самоконтрящаяся конус с одной стороны M30x3.5 H=24 SW46
\\BPW
6 шт 385,00 2 310,00
8 очиститель-обезжириватель тормозов! 500мл \\ 2 шт 411,00 822,00
9 полиуретан пфл-100 стержень 50мм 0,5 кг 1 555,00 778,00
10 р\\к суппорта, полный! направляющие + механизм подвода, Modul T \\
Haldex
5 шт 22 374,00 111 870,00
11 смазка для суппортов грузовых автомобилей ! МС TRB 100-2, 200 мл \\ 1 шт 1 129,00 1 129,00
12 смазка разрушитель ржавчины ! \\ 400 мл. 1 шт 507,00 507,00
13 шайба подвески! (м) упорная сайлентблока амортизатора \\SAF 12 шт 270,00 3 240,00
120 656,00 руб.
Итого: 189 821,00
В том числе НДС 34 230,02
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="gruzovye_rezervy")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 6)
        self.assertEqual(len(parts), 7)
        self.assertTrue(any(item["work_name"] == "Дисковый тормозной суппорт, Ремонт (полный) 5 шт. (кроме средней оси слева)" and item["line_total"] == 29000.0 for item in works))
        self.assertTrue(any(item["work_name"] == "Рычаг подвески - пластина изнашивания, ДиЗ 3 оси 12 шт" and item["quantity"] == 3.0 for item in works))
        self.assertTrue(any(item["part_name"] == "р\\к суппорта, полный! направляющие + механизм подвода, Modul T \\ Haldex" and item["quantity"] == 5.0 and item["line_total"] == 111870.0 for item in parts))
        self.assertTrue(any(item["part_name"] == "полиуретан пфл-100 стержень 50мм" and item["unit_name"] == "кг" and item["quantity"] == 0.5 for item in parts))
        self.assertEqual(parsed["extracted_fields"]["work_total"], 69165.0)
        self.assertEqual(parsed["extracted_fields"]["parts_total"], 120656.0)

    def test_parse_document_text_does_not_infer_gruzovye_rezervy_mileage_from_unrelated_model_digits(self) -> None:
        text = """
Заказ-наряд № ГП000209931 от 15 января 2026 г.
Исполнитель: Общество с ограниченной ответственностью "ГРУЗОВЫЕ РЕЗЕРВЫ"
Шасси: Schmitz, SKO, 24
VIN: WSM00000005217870 г/н: вв 3316 16
Заказчик: ООО ТК "Семьсот дорог" Год выпуска: 2018 Пробег: -
Агрегат: Carrier Модель : Vector1550
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="gruzovye_rezervy")

        self.assertNotIn("mileage", parsed["extracted_fields"])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])
        self.assertEqual(parsed["extracted_fields"]["vin"], "WSM00000005217870")
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "ВВ331616")

    def test_parse_document_text_skips_gruzovye_rezervy_order_and_mileage_review_for_invoice_only_documents(self) -> None:
        text = """
Внимание! Оплата данного счета означает согласие с условиями поставки товара.
Счет на оплату № ГП000002278 от 09 января 2026 г.
Исполнитель: Общество с ограниченной ответственностью "ГРУЗОВЫЕ РЕЗЕРВЫ"
Покупатель: ООО ТК "Семьсот дорог"
Автомобиль: г/н 2278 ОТ 09
№ Наименование товаров, работ, услуг Кол-во Ед. Цена Сумма
Материалы:
1 фильтр масляный 1 шт. 2 038,00 2 038,00
Итого к оплате: 49 038,00
В том числе НДС 8 842,92
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="gruzovye_rezervy")

        self.assertNotIn("order_number_missing", parsed["manual_review_reasons"])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])
        self.assertEqual(parsed["extracted_fields"]["repair_date"], "2026-01-09")
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "2278ОТ09")
        self.assertEqual(parsed["extracted_fields"]["vat_total"], 8842.92)
        self.assertEqual(parsed["extracted_fields"]["grand_total"], 49038.0)

    def test_parse_document_text_suppresses_leader_trak_invoice_only_noise_items(self) -> None:
        text = """
Внимание! Оплата данного счета означает согласие с условиями поставки товара.
Счет на оплату № ЛТ260002476 от 23.03.2026
Получатель
Общество с ограниченной ответственностью "ЛидерТрак"
Покупатель: ООО ТК "Семьсот дорог"
Автомобиль: ТР1064938
№ Наименование товаров, работ, услуг Кол-во Ед. Цена Сумма
1 н/ч 799,64 179,96
356,33 1 976,00Итого RUB:
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="leader_trak")

        self.assertEqual(parsed["extracted_items"]["works"], [])
        self.assertEqual(parsed["extracted_items"]["parts"], [])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])
        self.assertNotIn("work_total", parsed["extracted_fields"])
        self.assertNotIn("parts_total", parsed["extracted_fields"])
        self.assertIn("leader_trak_invoice_only_review_suppressed:mileage_missing", parsed["normalization_notes"])

    def test_parse_document_text_skips_logistics_missing_mileage_for_trailer_documents(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "ЛОГИСТИКА"
Заказ-наряд № 00000001633 от 30.09.2025
Автомобиль : П/П Koluman S, Koluman S гос. номер: ВО0156 16 VIN: NLFS3010000057266 год вып. 2022 пробег
Цена автомототранспортного средства, определяемая по соглашению сторон __________________
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="logistics")

        self.assertNotIn("mileage", parsed["extracted_fields"])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "ВО015616")
        self.assertEqual(parsed["extracted_fields"]["vin"], "NLFS3010000057266")

    def test_parse_document_text_does_not_infer_logistics_mileage_from_plate_digits(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "ЛОГИСТИКА"
Заказ-наряд № 00000002472 от 14.01.2026
Автомобиль : DongFen GX, DongFeng GX гос. номер: У026АХ 716 VIN: LGAG3DV29R8846629 год вып. 2024 пробег
Цена автомототранспортного средства, определяемая по соглашению сторон __________________
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="logistics")

        self.assertNotIn("mileage", parsed["extracted_fields"])
        self.assertNotIn("mileage_missing", parsed["manual_review_reasons"])
        self.assertEqual(parsed["extracted_fields"]["plate_number"], "У026АХ716")
        self.assertEqual(parsed["extracted_fields"]["vin"], "LGAG3DV29R8846629")

    def test_parse_document_text_extracts_logistics_work_and_part_tables(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "ЛОГИСТИКА"
Заказ-наряд № 00000002864 от 24.02.2026
Автомобиль : DONGFENG DFH4180, DONGFENG DFH4180 гос. номер: cс113кх716 VIN: LGAG3DV2XP8837385 год вып. 2023 пробег
462 000
Выполненные работы по заказ-наряду № 00000002864 от 24.02.2026 к причине обращения "EKAS горит красным"
№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9 10
1 Компьютерная
диагностика
1 2 786,89 1,000 3400 22% 3 400,01 613,12
2 Замена датчика нагрузки
на ось
1 2 786,89 1,000 3400 22% 3 400,01 613,12
3 Расходные материалы 1 630,00 1,000 630 22% 768,60 138,60
Итого работ: 3 на сумму: 7 568,62 1 364,84
Расходная накладная к заказ-наряду № 00000002864 от 24.02.2026 к причине обращения "EKAS горит красным"
№ Артикул Наименование Кол-во Ед.изм. Цена Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9
1 096,235 0,572882, Датчик давления, Sampa 1 шт 2 760,00 22% 3 367,20 607,20
Итого материалов: 1 на сумму: 3 367,20 607,20
Итого по заказ-наряду : 10 935,82 1 972,04
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="logistics")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 3)
        self.assertEqual(len(parts), 1)
        self.assertTrue(any(item["work_name"] == "Компьютерная диагностика" and item["line_total"] == 3400.01 for item in works))
        self.assertTrue(any(item["work_name"] == "Замена датчика нагрузки на ось" and item["standard_hours"] == 1.0 for item in works))
        self.assertTrue(any(item["part_name"] == "Датчик давления, Sampa" and item["line_total"] == 3367.2 for item in parts))

    def test_parse_document_text_extracts_logistics_multiline_materials_across_pages(self) -> None:
        text = """
ПОСТАВЩИК: Общество с ограниченной ответственностью "ЛОГИСТИКА"
Заказ-наряд № 00000000754 от 29.05.2025
Автомобиль : DongFen GX, DongFeng GX DFH4180 гос. номер: O106XB 716 VIN: LGAG3DV22N8829942 год вып. 2022
пробег 497 240
Выполненные работы по заказ-наряду № 00000000754 от 29.05.2025 к причине обращения
"ТО - 2"
№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9 10
1 ТО-2 (500 000) 1 2 333,33 7,700 2800 20% 21 559,97 3 593,33
2 Проверка и регулировка
клапанов
1 2 333,33 2,400 2800 20% 6 719,99 1 120,00
Итого работ: 2 на сумму: 28 279,96 4 713,33
Расходная накладная к заказ-наряду № 00000000754 от 29.05.2025 к причине обращения
"ТО - 2"
№ Артикул Наименование Кол-во Ед.изм. Цена Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9
1 3659445LLC МАСЛО Моторное ЛУКОЙЛ
АВАНГАРД ПРОФЕССИОНАЛ LA
10W-40 (198л)E6 бочка
40 л 375,38 20% 18 018,24 3 003,04
2 ZPC5465813 Масляный фильтр Е6 1 шт 6 353,86 20% 7 624,63 1 270,77
3 C4365703 Топливный фильтр 1 шт 1 527,50 20% 1 833,00 305,50
4 C1125030-H02B
0SFG
Топливный фильтр сепаратора E5, E6 1 шт 7 352,48 20% 8 822,98 1 470,50
11 Итого по странице материалов: 92 на сумму: 93 438,06 15 573,01
Расходная накладная к заказ-наряду № 00000000754 от 29.05.2025 к причине
обращения: ТО - 2 Страница: 2
№ Артикул Наименование Кол-во Ед.изм. Цена Ставка НДС Всего в т.ч. НДС
1 2 3 4 5 6 7 8 9
12 3557139LLC ЛУКОЙЛ АНТИФРИЗ G12++ (205л)
бочка
3 л 227,50 20% 819,00 136,50
13 SC622904 Фильтр КПП маслянный DAF XF-105
RANG WANG
1 шт 1 824,33 20% 2 189,20 364,87
Итого материалов: 96 на сумму: 96 446,26 16 074,38
Итого по заказ-наряду : 124 726,22 20 787,71
"""

        parsed = document_processing.parse_document_text(text, db=None, profile_scope="logistics")
        works = parsed["extracted_items"]["works"]
        parts = parsed["extracted_items"]["parts"]

        self.assertEqual(len(works), 2)
        self.assertGreaterEqual(len(parts), 6)
        self.assertTrue(any(item["work_name"] == "ТО-2 (500 000)" and item["line_total"] == 21559.97 for item in works))
        self.assertTrue(any(item["work_name"] == "Проверка и регулировка клапанов" and item["standard_hours"] == 2.4 for item in works))
        self.assertTrue(any(item["article"] == "3659445LLC" and item["quantity"] == 40.0 and item["unit_name"] == "л" for item in parts))
        self.assertTrue(any(item["article"] == "C1125030-H02B0SFG" and item["line_total"] == 8822.98 for item in parts))
        self.assertTrue(any(item["article"] == "3557139LLC" and item["line_total"] == 819.0 for item in parts))

    def test_parse_amount_accepts_common_ocr_separators(self) -> None:
        self.assertEqual(document_processing.parse_amount("201'712-03"), 201712.03)
        self.assertEqual(document_processing.parse_amount("2 057,40|"), 2057.4)


if __name__ == "__main__":
    unittest.main()
