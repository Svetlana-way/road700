# OCR Quality Report
Источник: `Заказ-наряды`
Режим OCR для аудита: `auto`
## Summary by Service
| Service | Profile | Docs | Order | Plate | VIN | Chassis | Mileage | Work total | Parts total | Grand total | Work lines | Part lines | Work sum ok | Part sum ok | Manual review free |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AXB | axb | 9 | 100% | 100% | 100% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Антарес | antares | 10 | 100% | 100% | 90% | 10% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Грузовые резервы | gruzovye_rezervy | 15 | 100% | 100% | 93% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| ЕТС | ets_act | 10 | 100% | 100% | 100% | 20% | 100% | 100% | 100% | 100% | 100% | 100% | 90% | 40% | 40% |
| ЛидерТрак | leader_trak | 24 | 100% | 100% | 100% | 50% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Логистика | logistics | 10 | 100% | 100% | 100% | 10% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20% | 20% |
| СибТракСкан | sibtrakscan | 17 | 100% | 100% | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 41% | 41% | 41% |
## Priority Queue
- `СибТракСкан` / `sibtrakscan`: score 50 on 17 docs. Main issues: work_total_mismatch, parts_total_mismatch.
- `Логистика` / `logistics`: score 40 on 10 docs. Main issues: parts_total_mismatch.
- `ЕТС` / `ets_act`: score 30 on 10 docs. Main issues: parts_total_mismatch, work_total_mismatch.
- `AXB` / `axb`: score 18 on 9 docs. Main issues: labor_norm_coverage_gap.
## Downstream Validation Signals
- `Заказ-наряды/Заказ наряды АXB/О894УХ716 и ВВ149116-.pdf`: labor norm coverage `0/1`.
- `Заказ-наряды/Заказ наряды АXB/во0154.pdf`: labor norm coverage `0/4`.
- `Заказ-наряды/Заказ наряды АXB/ву008616.pdf`: labor norm coverage `0/4`.
- `Заказ-наряды/Заказ наряды АXB/О106ХВ716.pdf`: labor norm coverage `1/10`.
- `Заказ-наряды/Заказ наряды АXB/с320мт716-1-3.pdf`: labor norm coverage `1/9`.
- `Заказ-наряды/Заказ наряды АXB/167016.pdf`: labor norm coverage `1/6`.
- `Заказ-наряды/Заказ наряды АXB/вв044416.pdf`: labor norm coverage `2/11`.
- `Заказ-наряды/Заказ наряды АXB/ЗН С113КХ716.pdf`: labor norm coverage `3/9`.
- `Заказ-наряды/Заказ наряды АXB/Док-ты У026АХ716 и ВУ693416-1-3.pdf`: labor norm coverage `4/10`, without OCR noise `4/9`.
## Document Details
### `Заказ-наряды/Заказ наряды АXB/167016.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000020577`, date `2025-05-02`, plate `ВУ167016`, vin `NPFCGSV30PA000038`, chassis `-`, mileage `296723`
- Totals: work `27975.6`, parts `39090.6`, vat `-`, grand `67066.2`
- Line items: works `6` (sum `27975.6`, match `True`), parts `2` (sum `39090.6`, match `True`)
- Manual review: `-`
- Labor norm coverage: `1/6`
### `Заказ-наряды/Заказ наряды АXB/Док-ты У026АХ716 и ВУ693416-1-3.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000018948`, date `2025-02-21`, plate `У026AX716`, vin `LGAG3DV29R8846629`, chassis `-`, mileage `153635`
- Totals: work `24130.0`, parts `56184.9`, vat `-`, grand `80314.9`
- Line items: works `10` (sum `24130.0`, match `True`), parts `7` (sum `56184.9`, match `True`)
- Manual review: `-`
- Labor norm coverage: `4/10`, without OCR noise `4/9`
### `Заказ-наряды/Заказ наряды АXB/ЗН С113КХ716.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000019084`, date `2025-02-26`, plate `C113KX716`, vin `LGAG3DV2XP8837385`, chassis `-`, mileage `259775`
- Totals: work `11172.0`, parts `20901.9`, vat `-`, grand `32073.9`
- Line items: works `9` (sum `11172.0`, match `True`), parts `7` (sum `20901.9`, match `True`)
- Manual review: `-`
- Labor norm coverage: `3/9`
### `Заказ-наряды/Заказ наряды АXB/О106ХВ716.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000019380`, date `2025-03-11`, plate `0106XB716`, vin `LGAG3DV22N8829942`, chassis `-`, mileage `431068`
- Totals: work `8208.0`, parts `35556.48`, vat `-`, grand `35237.34`
- Line items: works `10` (sum `8208.0`, match `True`), parts `2` (sum `35556.48`, match `True`)
- Manual review: `-`
- Labor norm coverage: `1/10`
### `Заказ-наряды/Заказ наряды АXB/О894УХ716 и ВВ149116-.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000018125`, date `2025-01-15`, plate `0894УХ716`, vin `LGAG3DV20P8831661`, chassis `-`, mileage `329100`
- Totals: work `1425.0`, parts `718.2`, vat `-`, grand `1425.0`
- Line items: works `1` (sum `1425.0`, match `True`), parts `3` (sum `718.2`, match `True`)
- Manual review: `-`
- Labor norm coverage: `0/1`
### `Заказ-наряды/Заказ наряды АXB/вв044416.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000021658`, date `2025-07-02`, plate `BB044416`, vin `WSM00000003313941`, chassis `-`, mileage `1480125`
- Totals: work `43023.6`, parts `2450.54`, vat `-`, grand `45474.14`
- Line items: works `11` (sum `43023.6`, match `True`), parts `9` (sum `2450.54`, match `True`)
- Manual review: `-`
- Labor norm coverage: `2/11`
### `Заказ-наряды/Заказ наряды АXB/во0154.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000020428`, date `2025-04-26`, plate `BO015416`, vin `NLFS3010000057267`, chassis `-`, mileage `148985`
- Totals: work `12585.6`, parts `12648.3`, vat `-`, grand `12648.3`
- Line items: works `4` (sum `12585.6`, match `True`), parts `1` (sum `12648.3`, match `True`)
- Manual review: `-`
- Labor norm coverage: `0/4`
### `Заказ-наряды/Заказ наряды АXB/ву008616.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000018636`, date `2025-02-07`, plate `ВУ008616`, vin `NPFCGSV30PA000016`, chassis `-`, mileage `104257`
- Totals: work `5510.0`, parts `1283.64`, vat `-`, grand `6793.64`
- Line items: works `4` (sum `5510.0`, match `True`), parts `3` (sum `1283.64`, match `True`)
- Manual review: `-`
- Labor norm coverage: `0/4`
### `Заказ-наряды/Заказ наряды АXB/с320мт716-1-3.pdf`
- Service: `AXB`
- Profile: `axb`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `0000019968`, date `2025-04-06`, plate `C320MT716`, vin `LGAG3DV20P8839078`, chassis `-`, mileage `250000`
- Totals: work `38167.2`, parts `50712.9`, vat `14813.35`, grand `88880.1`
- Line items: works `9` (sum `38167.2`, match `True`), parts `5` (sum `50712.9`, match `True`)
- Manual review: `-`
- Labor norm coverage: `1/9`
### `Заказ-наряды/Заказ наряды Антарес/Заказ-наряд № A0000017944 от 04.01.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000017944`, date `2025-01-04`, plate `K324BA716`, vin `X9PRG20A4MW137888`, chassis `-`, mileage `753500`
- Totals: work `35052.0`, parts `56247.65`, vat `15216.62`, grand `91299.65`
- Line items: works `16` (sum `35052.0`, match `True`), parts `10` (sum `56247.65`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Заказ-наряд № A0000018822 от 28.03.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000018822`, date `2025-03-28`, plate `K104CO716`, vin `X9PRG20A7MW139201`, chassis `-`, mileage `780340`
- Totals: work `37536.0`, parts `101475.69`, vat `23168.59`, grand `139011.69`
- Line items: works `13` (sum `37536.0`, match `True`), parts `18` (sum `101475.69`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Заказ-наряд № A0000020458 от 09.09.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000020458`, date `2025-09-09`, plate `A076EC716`, vin `-`, chassis `W119537`, mileage `1675500`
- Totals: work `18348.0`, parts `60662.99`, vat `13168.5`, grand `79010.99`
- Line items: works `10` (sum `18348.0`, match `True`), parts `9` (sum `60662.99`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная форма Заказ-наряд № A0000019619 от 14.06.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000019619`, date `2025-06-14`, plate `K060BA716`, vin `X9PRG20A4MW137891`, chassis `-`, mileage `950500`
- Totals: work `7728.0`, parts `88197.25`, vat `15987.54`, grand `95925.25`
- Line items: works `3` (sum `7728.0`, match `True`), parts `4` (sum `88197.25`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная форма Заказ-наряд № A0000019693 от 21.06.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000019693`, date `2025-06-21`, plate `A513CE716`, vin `X9PRG20A7JW120532`, chassis `-`, mileage `1601957`
- Totals: work `14970.0`, parts `38610.52`, vat `8930.09`, grand `53580.52`
- Line items: works `6` (sum `14970.0`, match `True`), parts `4` (sum `38610.52`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная форма Заказ-наряд № A0000019751 от 29.06.2025.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000019751`, date `2025-06-29`, plate `K296AH716`, vin `X9PRG20A3MW137834`, chassis `-`, mileage `890765`
- Totals: work `25392.0`, parts `44863.78`, vat `11709.3`, grand `70255.78`
- Line items: works `9` (sum `25392.0`, match `True`), parts `2` (sum `44863.78`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная форма Заказ-наряд № A21909 от 22.01.2026.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000021909`, date `2026-01-22`, plate `K035CO716`, vin `X9PRG20A7MW139215`, chassis `-`, mileage `875597`
- Totals: work `42164.6`, parts `68227.01`, vat `19906.69`, grand `110391.61`
- Line items: works `13` (sum `42164.6`, match `True`), parts `24` (sum `68227.01`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная форма Заказ-наряд № A22257 от 20.02.2026.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000022257`, date `2026-02-20`, plate `K915AH716`, vin `X9PRG20A7MW137884`, chassis `-`, mileage `1100000`
- Totals: work `44231.8`, parts `88196.73`, vat `23880.57`, grand `132428.53`
- Line items: works `18` (sum `44231.8`, match `True`), parts `16` (sum `88196.73`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная_форма_Заказ-наряд_№_A0000020901_от_18.10.2025 1.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000020901`, date `2025-10-18`, plate `K357BA716`, vin `X9PRG20A1MW137931`, chassis `-`, mileage `963609`
- Totals: work `38854.0`, parts `73924.24`, vat `18796.38`, grand `112778.24`
- Line items: works `15` (sum `38854.0`, match `True`), parts `14` (sum `73924.24`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Антарес/Печатная_форма_Заказ-наряд_№_A21469_от_06.12.2025 1.pdf`
- Service: `Антарес`
- Profile: `antares`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `A0000021469`, date `2025-12-06`, plate `K346CO716`, vin `X9PRG30A1MW139233`, chassis `-`, mileage `918672`
- Totals: work `34144.0`, parts `298541.09`, vat `55447.52`, grand `332685.09`
- Line items: works `13` (sum `34144.0`, match `True`), parts `14` (sum `298541.09`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /3316.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000209931`, date `2026-01-15`, plate `ВВ331616`, vin `WSM00000005217870`, chassis `-`, mileage `-`
- Totals: work `94250.0`, parts `74485.0`, vat `30427.67`, grand `168735.0`
- Line items: works `16` (sum `94250.0`, match `True`), parts `23` (sum `74485.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Заказ-Наряд (Диадок) № ГПТ00001543 от 19.01.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000210722`, date `2026-01-19`, plate `ВУ296516`, vin `NLS3DFFSTP1064773`, chassis `-`, mileage `-`
- Totals: work `69165.0`, parts `120656.0`, vat `34230.02`, grand `189821.0`
- Line items: works `6` (sum `69165.0`, match `True`), parts `7` (sum `120656.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Заказ-Наряд (Диадок) № ГПТ00004355 от 12.02.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000215622`, date `2026-02-12`, plate `С163МК716`, vin `LGAG3DV22P8837316`, chassis `-`, mileage `462501`
- Totals: work `25420.0`, parts `80279.0`, vat `19060.49`, grand `105699.0`
- Line items: works `11` (sum `25420.0`, match `True`), parts `9` (sum `80279.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № 2 от 3.1.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000216975`, date `2026-02-18`, plate `С763РЕ716`, vin `LGAG3DV21P8840756`, chassis `-`, mileage `353673`
- Totals: work `64790.0`, parts `184989.0`, vat `45042.12`, grand `249779.0`
- Line items: works `20` (sum `64790.0`, match `True`), parts `24` (sum `184989.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № 2 от 3.2.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000216970`, date `2026-02-18`, plate `ВВ036416`, vin `WSM00000005199072`, chassis `-`, mileage `-`
- Totals: work `50530.0`, parts `123386.0`, vat `31361.91`, grand `173916.0`
- Line items: works `8` (sum `50530.0`, match `True`), parts `9` (sum `123386.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № 2 от 3.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000216973`, date `2026-02-18`, plate `С573НО716`, vin `LGAG3DV29P8839063`, chassis `-`, mileage `447228`
- Totals: work `64170.0`, parts `228650.0`, vat `52803.62`, grand `292820.0`
- Line items: works `15` (sum `64170.0`, match `True`), parts `23` (sum `228650.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № ГПТ00001273 от 16.01.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000210188`, date `2026-01-16`, plate `С611РН716`, vin `LGAG3DV29P8841394`, chassis `-`, mileage `370200`
- Totals: work `9300.0`, parts `93700.0`, vat `18573.77`, grand `103000.0`
- Line items: works `1` (sum `9300.0`, match `True`), parts `1` (sum `93700.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № ГПТ00003283 от 02.02.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000213716`, date `2026-02-02`, plate `С863МС716`, vin `LGAG3DV28P8839118`, chassis `-`, mileage `489872`
- Totals: work `59985.0`, parts `159920.0`, vat `39655.01`, grand `219905.0`
- Line items: works `12` (sum `59985.0`, match `True`), parts `25` (sum `159920.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд (Диадок) № ГПТ00003326 от 03.02.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000213970`, date `2026-02-03`, plate `ВВ036616`, vin `WSM00000005199079`, chassis `-`, mileage `-`
- Totals: work `9300.0`, parts `33160.0`, vat `7656.72`, grand `42460.0`
- Line items: works `3` (sum `9300.0`, match `True`), parts `3` (sum `33160.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд к ГПТ00005202 от 19.02.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000217211`, date `2026-02-19`, plate `ВА491116`, vin `X1Y908400R3279932`, chassis `-`, mileage `1514135`
- Totals: work `105270.0`, parts `170771.0`, vat `49777.86`, grand `276041.0`
- Line items: works `16` (sum `105270.0`, match `True`), parts `24` (sum `170771.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд к ГПТ00005850 от 25.02.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000218352`, date `2026-02-25`, plate `ВУ264316`, vin `NLS3DFFSTP1064738`, chassis `-`, mileage `-`
- Totals: work `79050.0`, parts `105595.0`, vat `33296.66`, grand `184645.0`
- Line items: works `10` (sum `79050.0`, match `True`), parts `4` (sum `105595.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд к ГПТ00006810 от 05.03.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000219918`, date `2026-03-05`, plate `К104СО716`, vin `X9PRG20A7MW139201`, chassis `-`, mileage `988552`
- Totals: work `31930.0`, parts `66766.0`, vat `17797.63`, grand `98696.0`
- Line items: works `12` (sum `31930.0`, match `True`), parts `5` (sum `66766.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд к ГПТ00007277 от 10.03.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000220799`, date `2026-03-10`, plate `ВВ269416`, vin `WSM00000003313952`, chassis `-`, mileage `-`
- Totals: work `68820.0`, parts `96156.0`, vat `29749.77`, grand `164976.0`
- Line items: works `11` (sum `68820.0`, match `True`), parts `16` (sum `96156.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Печатная форма Заказ-Наряд к ГПТ00007294 от 10.03.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ГП000220663`, date `2026-03-10`, plate `ВВ047316`, vin `WSM00000005208662`, chassis `-`, mileage `-`
- Totals: work `79750.0`, parts `102001.0`, vat `32774.8`, grand `181751.0`
- Line items: works `14` (sum `79750.0`, match `True`), parts `31` (sum `102001.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Грузовые резервы /Счет (Диадок) № ГПТ00000512 от 09.01.2026.pdf`
- Service: `Грузовые резервы`
- Profile: `gruzovye_rezervy`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `-`, date `2026-01-09`, plate `2278ОТ09`, vin `-`, chassis `-`, mileage `-`
- Totals: work `-`, parts `2038.0`, vat `8842.92`, grand `49038.0`
- Line items: works `0` (sum `-`, match `-`), parts `5` (sum `2038.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/700д 350.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `80381`, date `2025-02-03`, plate `К350ВА716`, vin `X9PRG20A0LW130676`, chassis `-`, mileage `1089300`
- Totals: work `57940.0`, parts `110153.36`, vat `33618.67`, grand `201712.03`
- Line items: works `17` (sum `522.3`, match `False`), parts `1` (sum `300.0`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/700д 773.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_vision_ocr`
- Extract failure: `-`
- Header: order `79605`, date `2025-01-06`, plate `А773НР716`, vin `YV2RG20A8JA816091`, chassis `-`, mileage `1395182`
- Totals: work `10970.0`, parts `4137.76`, vat `3021.54`, grand `18129.3`
- Line items: works `6` (sum `10970.0`, match `True`), parts `1` (sum `6.0`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Акт №81121 от 03.03.25.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `81121`, date `2025-03-03`, plate `А477НХ716`, vin `X9PRG20A8JW120667`, chassis `-`, mileage `450320`
- Totals: work `10150.0`, parts `52559.67`, vat `12541.93`, grand `75251.6`
- Line items: works `3` (sum `10150.0`, match `True`), parts `2` (sum `52559.67`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Акт №81459 от 15.03.25.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `81459`, date `2025-03-15`, plate `К346СО716`, vin `X9PRG30A1MW139233`, chassis `-`, mileage `190`
- Totals: work `28040.0`, parts `81086.58`, vat `21825.31`, grand `130951.89`
- Line items: works `18` (sum `28040.0`, match `True`), parts `20` (sum `48960.25`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Акт №83139 от 14.05.25.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `83139`, date `2025-05-14`, plate `А604ХВ116`, vin `X9PRG20A9HW117657`, chassis `-`, mileage `606098`
- Totals: work `22040.0`, parts `46103.16`, vat `13628.64`, grand `81771.8`
- Line items: works `11` (sum `22040.0`, match `True`), parts `4` (sum `11332.5`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Акт №88169 от 08.11.25.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `88169`, date `2025-11-08`, plate `К662ВА716`, vin `X9PRG20A5LW131404`, chassis `-`, mileage `203040`
- Totals: work `24840.0`, parts `8188.02`, vat `6605.6`, grand `39633.62`
- Line items: works `8` (sum `24840.0`, match `True`), parts `7` (sum `8188.02`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Акт №89771 от 07.01.26.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `89771`, date `2026-01-07`, plate `К229ВА716`, vin `X9PRG20A7MW137903`, chassis `-`, mileage `29326`
- Totals: work `14490.0`, parts `68083.66`, vat `18166.2`, grand `100739.86`
- Line items: works `12` (sum `14490.0`, match `True`), parts `10` (sum `67991.41`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Печатная форма Акт №91111 от 21.02.26.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `91111`, date `2026-02-21`, plate `С847МС716`, vin `LGAG3DV20P8839131`, chassis `C4365842`, mileage `570`
- Totals: work `33150.0`, parts `67065.92`, vat `22047.51`, grand `122263.43`
- Line items: works `5` (sum `33150.0`, match `True`), parts `8` (sum `8126.73`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Печатная_форма_Акт_№84995_от_20.07.25 1.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `84995`, date `2025-07-20`, plate `А513СЕ716`, vin `X9PRG20A7JW120532`, chassis `W120532`, mileage `621086`
- Totals: work `17030.0`, parts `56109.96`, vat `14627.99`, grand `87767.95`
- Line items: works `13` (sum `17030.0`, match `True`), parts `13` (sum `56109.96`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды ЕТС/Печатная_форма_Акт_№87067_от_01.10.25 1.pdf`
- Service: `ЕТС`
- Profile: `ets_act`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `87067`, date `2025-10-01`, plate `К296АН716`, vin `X9PRG20A3MW137834`, chassis `-`, mileage `110`
- Totals: work `18980.0`, parts `6731.49`, vat `5142.29`, grand `30853.78`
- Line items: works `9` (sum `18980.0`, match `True`), parts `7` (sum `6731.49`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250002311 от 28.02.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250002311`, date `2025-02-28`, plate `091СЕМ716`, vin `LGAG3DV28P8834744`, chassis `P8834744`, mileage `229142`
- Totals: work `54484.18`, parts `96139.18`, vat `30553.14`, grand `183319.0`
- Line items: works `19` (sum `54484.18`, match `True`), parts `15` (sum `96139.18`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250004899 от 12.05.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250004899`, date `2025-05-12`, plate `831ОТТ716`, vin `LGAG3DV22P8830897`, chassis `-`, mileage `416695`
- Totals: work `28520.83`, parts `80164.17`, vat `21737.0`, grand `130422.0`
- Line items: works `5` (sum `28520.83`, match `True`), parts `1` (sum `80164.17`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250005926 от 13.06.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250005926`, date `2025-06-13`, plate `0443ВВ16`, vin `X1Y908400R3313945`, chassis `-`, mileage `1146856`
- Totals: work `56360.84`, parts `132210.85`, vat `37714.31`, grand `226286.0`
- Line items: works `17` (sum `56360.84`, match `True`), parts `30` (sum `132210.85`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250007012 от 17.07.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250007012`, date `2025-07-17`, plate `699КВА716`, vin `X9PRG20A4KW129853`, chassis `W129853`, mileage `1198697`
- Totals: work `104235.85`, parts `326750.83`, vat `86197.32`, grand `517184.0`
- Line items: works `46` (sum `104235.85`, match `True`), parts `33` (sum `326750.83`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250008749 от 10.09.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250008749`, date `2025-09-10`, plate `115СКХ716`, vin `LGAG3DV20P8837458`, chassis `P8837458`, mileage `401093`
- Totals: work `13054.17`, parts `79063.33`, vat `18423.5`, grand `110541.0`
- Line items: works `4` (sum `13054.17`, match `True`), parts `3` (sum `79063.33`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250008887 от 13.09.2025 (1).pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250008887`, date `2025-09-13`, plate `LM1109910`, vin `LGAG3DV25P8834118`, chassis `P8834118`, mileage `494732`
- Totals: work `61767.5`, parts `155636.67`, vat `43480.83`, grand `260885.0`
- Line items: works `17` (sum `61767.5`, match `True`), parts `23` (sum `155636.67`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250009047 от 18.09.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250009047`, date `2025-09-18`, plate `667КВА716`, vin `X9PRG20AXLW132788`, chassis `W132788`, mileage `1163000`
- Totals: work `62220.84`, parts `248037.5`, vat `63444.33`, grand `380666.0`
- Line items: works `26` (sum `62220.84`, match `True`), parts `19` (sum `248037.5`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250009582 от 03.10.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250009582`, date `2025-10-03`, plate `7322ВР16`, vin `NLFS3010000056659`, chassis `-`, mileage `270045`
- Totals: work `72120.82`, parts `234125.84`, vat `61249.34`, grand `367496.0`
- Line items: works `13` (sum `72120.82`, match `True`), parts `11` (sum `234125.84`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250010000 от 17.10.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250010000`, date `2025-10-17`, plate `602СРН716`, vin `LGAG3DV25P8841313`, chassis `-`, mileage `344141`
- Totals: work `52200.0`, parts `142236.64`, vat `38887.36`, grand `233324.0`
- Line items: works `23` (sum `52200.0`, match `True`), parts `22` (sum `142236.64`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250010044 от 18.10.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250010044`, date `2025-10-18`, plate `587СРН716`, vin `LGAG3DV23P8841391`, chassis `-`, mileage `295566`
- Totals: work `67070.84`, parts `121350.82`, vat `37684.34`, grand `226106.0`
- Line items: works `24` (sum `67070.84`, match `True`), parts `24` (sum `121350.82`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250010740 от 08.11.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250010740`, date `2025-11-08`, plate `JY914296`, vin `XJY914296P0000588`, chassis `-`, mileage `1`
- Totals: work `56695.83`, parts `136035.83`, vat `38546.34`, grand `231278.0`
- Line items: works `17` (sum `56695.83`, match `True`), parts `13` (sum `136035.83`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250010860 от 12.11.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250010860`, date `2025-11-12`, plate `0441ВВ16`, vin `WSM00000005208659`, chassis `-`, mileage `1230984`
- Totals: work `25515.01`, parts `72250.83`, vat `19553.16`, grand `117319.0`
- Line items: works `9` (sum `25515.01`, match `True`), parts `9` (sum `72250.83`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250011521 от 06.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250011521`, date `2025-12-06`, plate `182КВА716`, vin `X9PRG20A3LW130672`, chassis `W130672`, mileage `1286591`
- Totals: work `111684.15`, parts `259113.34`, vat `88013.01`, grand `528078.0`
- Line items: works `23` (sum `111684.15`, match `True`), parts `19` (sum `259113.34`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012276`, date `2025-12-25`, plate `879КВА716`, vin `X9PRG20A4MW137776`, chassis `W137776`, mileage `953917`
- Totals: work `32035.83`, parts `37990.84`, vat `14005.33`, grand `84032.0`
- Line items: works `20` (sum `32035.83`, match `True`), parts `12` (sum `37990.84`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012296 от 30.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012296`, date `2025-12-30`, plate `867СМТ716`, vin `XU557582AP3000201`, chassis `-`, mileage `247802`
- Totals: work `24829.16`, parts `24554.17`, vat `9876.67`, grand `59260.0`
- Line items: works `5` (sum `24829.16`, match `True`), parts `23` (sum `24554.17`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012319 от 27.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012319`, date `2025-12-27`, plate `4895ВН16`, vin `X1Y908400R3275536`, chassis `-`, mileage `1709955`
- Totals: work `71567.51`, parts `149186.68`, vat `44150.81`, grand `264905.0`
- Line items: works `18` (sum `71567.51`, match `True`), parts `20` (sum `149186.68`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012335 от 27.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012335`, date `2025-12-27`, plate `299СМР716`, vin `XU557582AP3000197`, chassis `-`, mileage `220088`
- Totals: work `22256.67`, parts `22222.51`, vat `8895.82`, grand `53375.0`
- Line items: works `5` (sum `22256.67`, match `True`), parts `15` (sum `22222.51`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012346 от 26.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012346`, date `2025-12-26`, plate `JY914296`, vin `XJY914296P0000575`, chassis `P0000575`, mileage `1`
- Totals: work `7775.83`, parts `109.17`, vat `1577.0`, grand `9462.0`
- Line items: works `3` (sum `7775.83`, match `True`), parts `1` (sum `109.17`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012362 от 27.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012362`, date `2025-12-27`, plate `168СМК716`, vin `LGAG3DV29P8837586`, chassis `P8837586`, mileage `541316`
- Totals: work `54324.16`, parts `80585.83`, vat `26982.01`, grand `161892.0`
- Line items: works `23` (sum `54324.16`, match `True`), parts `13` (sum `80585.83`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012373 от 27.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012373`, date `2025-12-27`, plate `324КВА716`, vin `X9PRG20A4MW137888`, chassis `W137888`, mileage `962300`
- Totals: work `52721.66`, parts `72926.65`, vat `25129.69`, grand `150778.0`
- Line items: works `26` (sum `52721.66`, match `True`), parts `19` (sum `72926.65`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012397 от 28.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012397`, date `2025-12-28`, plate `JY914296`, vin `XJY914296P0000587`, chassis `P0000587`, mileage `14`
- Totals: work `16361.67`, parts `6150.0`, vat `4502.33`, grand `27014.0`
- Line items: works `4` (sum `16361.67`, match `True`), parts `2` (sum `6150.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012414 от 29.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012414`, date `2025-12-29`, plate `915КАН716`, vin `X9PRG20A7MW137884`, chassis `W137884`, mileage `1043787`
- Totals: work `31849.99`, parts `230554.18`, vat `52480.83`, grand `314885.0`
- Line items: works `15` (sum `31849.99`, match `True`), parts `12` (sum `230554.18`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012416 от 29.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012416`, date `2025-12-29`, plate `263ОТВ716`, vin `LGAG3DV24P8831596`, chassis `-`, mileage `599440`
- Totals: work `32480.84`, parts `104515.83`, vat `27399.33`, grand `164396.0`
- Line items: works `13` (sum `32480.84`, match `True`), parts `21` (sum `104515.83`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Лидер Трак/Заказ-наряд №ЛТ250012417 от 30.12.2025.pdf`
- Service: `ЛидерТрак`
- Profile: `leader_trak`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЛТ250012417`, date `2025-12-30`, plate `0441ВВ16`, vin `WSM00000005208659`, chassis `-`, mileage `1230984`
- Totals: work `35874.17`, parts `7171.67`, vat `8969.16`, grand `53815.0`
- Line items: works `9` (sum `35874.17`, match `True`), parts `6` (sum `7171.67`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 1633 от 30.09.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000001633`, date `2025-09-30`, plate `ВО015616`, vin `NLFS3010000057266`, chassis `-`, mileage `-`
- Totals: work `20439.98`, parts `13329.35`, vat `-`, grand `33769.33`
- Line items: works `3` (sum `20439.98`, match `True`), parts `3` (sum `12939.22`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 1919 от 05.11.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000001919`, date `2025-11-05`, plate `ВУ008616`, vin `NPFCGSV30PA000016`, chassis `-`, mileage `-`
- Totals: work `17639.98`, parts `8800.36`, vat `-`, grand `26440.34`
- Line items: works `2` (sum `17639.98`, match `True`), parts `1` (sum `8098.36`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 2109 от 26.11.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000002109`, date `2025-11-26`, plate `ВВ038916`, vin `X1Y908400R3313900`, chassis `-`, mileage `-`
- Totals: work `5431.99`, parts `756.3`, vat `-`, grand `6188.29`
- Line items: works `3` (sum `5431.99`, match `True`), parts `1` (sum `27.3`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 2318 от 15.12.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000002318`, date `2025-12-15`, plate `ВО015716`, vin `NLFS3010000056568`, chassis `-`, mileage `-`
- Totals: work `53749.95`, parts `72256.46`, vat `-`, grand `126006.41`
- Line items: works `9` (sum `53749.95`, match `True`), parts `6` (sum `71527.46`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 2472 от 14.01.2026.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000002472`, date `2026-01-14`, plate `У026АХ716`, vin `LGAG3DV29R8846629`, chassis `-`, mileage `-`
- Totals: work `15950.01`, parts `25400.11`, vat `-`, grand `41350.12`
- Line items: works `1` (sum `15950.01`, match `True`), parts `6` (sum `25083.4`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 2676 от 31.01.2026.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000002676`, date `2026-01-31`, plate `С113КХ716`, vin `LGAG3DV2XP8837385`, chassis `-`, mileage `450000`
- Totals: work `21349.98`, parts `80677.45`, vat `-`, grand `102027.43`
- Line items: works `2` (sum `21349.98`, match `True`), parts `7` (sum `80186.09`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 2864 от 24.02.2026.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000002864`, date `2026-02-24`, plate `С113КХ716`, vin `LGAG3DV2XP8837385`, chassis `-`, mileage `462000`
- Totals: work `7568.62`, parts `3367.2`, vat `-`, grand `10935.82`
- Line items: works `3` (sum `7568.62`, match `True`), parts `1` (sum `3367.2`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 754 от 29.05.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000000754`, date `2025-05-29`, plate `O106XB716`, vin `LGAG3DV22N8829942`, chassis `C4365703`, mileage `497240`
- Totals: work `28279.96`, parts `96446.26`, vat `20787.71`, grand `124726.22`
- Line items: works `2` (sum `28279.96`, match `True`), parts `13` (sum `96446.26`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 906 от 20.06.2025.pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000000906`, date `2025-06-20`, plate `С027НМ716`, vin `LGAG3DV22P8839132`, chassis `-`, mileage `270239`
- Totals: work `26879.98`, parts `31006.56`, vat `9647.76`, grand `57886.54`
- Line items: works `5` (sum `26879.98`, match `True`), parts `4` (sum `28741.44`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды Логистика /Заказ-наряд № 986 от 01.07.2025 (2).pdf`
- Service: `Логистика`
- Profile: `logistics`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `00000000986`, date `2025-07-01`, plate `С163МК716`, vin `LGAG3DV22P8837316`, chassis `-`, mileage `345520`
- Totals: work `18199.98`, parts `35744.55`, vat `-`, grand `53944.53`
- Line items: works `5` (sum `18199.98`, match `True`), parts `5` (sum `31992.45`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26002072`, date `2026-03-09`, plate `С026ВВ716`, vin `-`, chassis `P8834073`, mileage `639889`
- Totals: work `23487.0`, parts `88110.0`, vat `24551.34`, grand `136148.34`
- Line items: works `7` (sum `23487.0`, match `True`), parts `6` (sum `88110.0`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/860.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001966`, date `2026-03-02`, plate `У860АР716`, vin `-`, chassis `R8846633`, mileage `350000`
- Totals: work `42123.0`, parts `92924.96`, vat `29710.57`, grand `164758.53`
- Line items: works `12` (sum `42123.0`, match `True`), parts `10` (sum `92924.96`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Документ №СТ260215016 от 15.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001368`, date `2026-02-12`, plate `С577КУ716`, vin `-`, chassis `P8837457`, mileage `496708`
- Totals: work `86526.06`, parts `122876.36`, vat `37761.1`, grand `209402.42`
- Line items: works `11` (sum `70923.0`, match `False`), parts `23` (sum `92571.32`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260131040 от 31.01.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26000827`, date `2026-01-31`, plate `С602РН716`, vin `-`, chassis `P8841313`, mileage `396236`
- Totals: work `85570.35`, parts `168182.98`, vat `45758.81`, grand `253753.33`
- Line items: works `13` (sum `67439.63`, match `False`), parts `22` (sum `137854.89`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260209043 от 09.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001202`, date `2026-02-08`, plate `У146ВВ716`, vin `-`, chassis `R8843173`, mileage `300878`
- Totals: work `34923.0`, parts `61293.9`, vat `21167.72`, grand `117384.62`
- Line items: works `6` (sum `34923.0`, match `True`), parts `9` (sum `61293.9`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260210043 от 10.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001203`, date `2026-02-08`, plate `С392МО716`, vin `-`, chassis `P8839121`, mileage `320417`
- Totals: work `52078.14`, parts `158603.36`, vat `37991.75`, grand `37991.75`
- Line items: works `11` (sum `42687.0`, match `False`), parts `14` (sum `130002.75`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260221023 от 21.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001680`, date `2026-02-20`, plate `С087АР716`, vin `-`, chassis `P8834118`, mileage `601000`
- Totals: work `48238.35`, parts `151672.43`, vat `36049.49`, grand `199910.78`
- Line items: works `6` (sum `39539.63`, match `False`), parts `20` (sum `121259.66`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260222020 от 22.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001637`, date `2026-02-19`, plate `С469АС716`, vin `-`, chassis `P8834102`, mileage `506884`
- Totals: work `30894.06`, parts `48887.84`, vat `14386.9`, grand `8.36`
- Line items: works `7` (sum `25323.0`, match `False`), parts `3` (sum `40072.0`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260227013 от 27.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26000747`, date `2026-01-26`, plate `С775АУ716`, vin `-`, chassis `P8833724`, mileage `501178`
- Totals: work `121023.0`, parts `121741.78`, vat `53408.25`, grand `296173.03`
- Line items: works `9` (sum `121023.0`, match `True`), parts `32` (sum `121741.78`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260227018 от 27.02.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26001771`, date `2026-02-25`, plate `У837АР716`, vin `-`, chassis `R8846409`, mileage `308860`
- Totals: work `53070.0`, parts `119942.65`, vat `31199.0`, grand `173012.65`
- Line items: works `8` (sum `43500.0`, match `False`), parts `23` (sum `94204.65`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260307027 от 07.03.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26002101`, date `2026-03-06`, plate `У650ВА716`, vin `-`, chassis `R8833458`, mileage `340151`
- Totals: work `51285.3`, parts `90530.93`, vat `25573.42`, grand `141816.23`
- Line items: works `10` (sum `39937.13`, match `False`), parts `11` (sum `74205.68`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260308001 от 08.03.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26002064`, date `2026-03-05`, plate `С789ВЕ716`, vin `-`, chassis `P8833869`, mileage `505213`
- Totals: work `42723.0`, parts `62776.65`, vat `23209.92`, grand `128709.57`
- Line items: works `7` (sum `42723.0`, match `True`), parts `8` (sum `62776.65`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260309022 от 09.03.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26002165`, date `2026-03-09`, plate `О661ТХ716`, vin `-`, chassis `P8832001`, mileage `565696`
- Totals: work `7320.0`, parts `68832.4`, vat `13732.4`, grand `2.0`
- Line items: works `1` (sum `6000.0`, match `False`), parts `1` (sum `56420.0`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная форма Документ №СТ260314005 от 14.03.2026.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26002226`, date `2026-03-11`, plate `С026ВВ716`, vin `-`, chassis `P8834073`, mileage `639889`
- Totals: work `9000.0`, parts `66992.17`, vat `16718.27`, grand `92710.44`
- Line items: works `3` (sum `9000.0`, match `True`), parts `5` (sum `66992.17`, match `True`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная_форма_Документ_№СТ260105015_от_05.01.2026 1.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26000018`, date `2026-01-03`, plate `У875ВА716`, vin `-`, chassis `R8846627`, mileage `298826`
- Totals: work `70788.06`, parts `170690.84`, vat `43545.39`, grand `43545.39`
- Line items: works `7` (sum `58023.0`, match `False`), parts `13` (sum `125541.71`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная_форма_Документ_№СТ260109017_от_09.01.2026 1.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26000105`, date `2026-01-08`, plate `О750СХ716`, vin `-`, chassis `N8829880`, mileage `523689`
- Totals: work `28698.06`, parts `138143.08`, vat `30086.11`, grand `166841.14`
- Line items: works `6` (sum `23523.0`, match `False`), parts `4` (sum `111435.93`, match `False`)
- Manual review: `-`
### `Заказ-наряды/Заказ наряды СибТракСкан/Печатная_форма_Документ_№СТ260111012_от_11.01.2026 1.pdf`
- Service: `СибТракСкан`
- Profile: `sibtrakscan`
- Extract source: `pdf_text`
- Extract failure: `-`
- Header: order `ЗСТ26000126`, date `2026-01-09`, plate `У026АХ716`, vin `-`, chassis `R8846629`, mileage `346491`
- Totals: work `43080.0`, parts `91673.33`, vat `29645.74`, grand `164399.07`
- Line items: works `13` (sum `43080.0`, match `True`), parts `7` (sum `91673.33`, match `True`)
- Manual review: `-`
