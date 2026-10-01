# Bulletin URL and filename patterns

This guide describes the direct PDF links observed in the two [master URL inventories](bulletin-url-inventory-2024-and-earlier.md) and [2025–2026 inventory](bulletin-url-inventory-2025-2026.md). The most recent evidence (2024–2026) receives the most weight because parish sites and upload conventions can change. Older examples are retained to show historical variation, not to override a newer archive link.

## How to use these patterns

1. **Follow the bulletin page or its year-specific archive and use the exact PDF link whenever possible.** A page called “Archived Bulletins,” “2025 Bulletins,” etc. may be separate from the current bulletin page. The 2025 archive for St. Joseph, Sacred Heart, and St. Paul is [here](https://4e1jla.sites.ecatholic.com/2025-bulletins); its 2026 archive is [here](https://4e1jla.sites.ecatholic.com/2026-bulletins).
2. Use the patterns below only to form candidates when an archive link is unavailable. A naming pattern cannot establish that an issue exists or that it covers the date in its filename.
3. Confirm candidates by opening the PDF and checking its printed date/coverage. A 403, timeout, or failed guess does not prove that a bulletin is absent. A date without its own file may be covered by a combined issue, or the site may not have published an issue that week.
4. Treat the actual link as authoritative for its folder, spelling, punctuation, spaces, suffixes, and capitalization. Strip optional `?t=...` query parameters when recording/comparing URLs; they are not part of the PDF filename.

The ten configured source pages are the ones recorded in `public/churches.json` (32 church records). The inventories include direct archive-linked PDFs, with older archive pages collected as far back as they exposed links. Central Essex (`18911`) has no linked pre-2025 entries in the inspected archive. This means no older links were found in that source inventory, not that no older bulletins exist elsewhere.

## Recent observed formats by source

| Source / configured page | Observed direct URL shape | What the 2024–2026 inventory shows |
|---|---|---|
| Amherstburg-Harrow (`26217`), [bulletins](https://www.ahcfop.ca/bulletins) | `https://files.ecatholic.com/26217/bulletins/YYYYMMDD.pdf` | Exact eight-digit issue-date filename in all inventoried links, including 2025–2026. Some PDFs cover multiple Sundays; the filename generally identifies the first/primary date. |
| Central Essex (`18911`), [bulletins](https://5q3p4a.sites.ecatholic.com/bulletins) | `https://files.ecatholic.com/18911/bulletins/YYYYMMDD.pdf` | Exact eight-digit date format in all inventoried 2025–2026 links. No pre-2025 links were found on the inspected archive. |
| St. Joseph / Sacred Heart / St. Paul (`21238`), [bulletins](https://4e1jla.sites.ecatholic.com/bulletin) | `https://files.ecatholic.com/21238/documents/YYYY/M/<uploader filename>.pdf` | Descriptive names are irregular. 2025 issues are often stored in `/documents/2026/1/`; 2026 examples usually use a folder matching upload year/month. Filenames use spaces or underscores, single or paired dates, special titles, punctuation, typos, and numeric suffixes. Do not calculate the folder from the issue date. |
| South Windsor (`21089`), [bulletins](https://ly42ja.sites.ecatholic.com/bulletins) | `https://files.ecatholic.com/21089/bulletins/YYYYMMDD.pdf` | Exact eight-digit date format in inventoried 2024–2026 links. Combined coverage still occurs; 2025 December 21 covers December 28 as well. Two 2026 weeks had no corresponding archive-linked file in the checked inventory. |
| Rose City (`20008`), [bulletins](https://www.olph.dionet.org/bulletins) | `https://files.ecatholic.com/20008/bulletins/YYYYMMDD.pdf` | Exact eight-digit date format in inventoried 2024–2026 links. The configured page is the inspected source; it may not represent every separate parish archive on the broader site. |
| North Central Windsor (`21202`), [bulletins](https://z253oa.sites.ecatholic.com/bulletins) | `https://files.ecatholic.com/21202/bulletins/YYYYMMDD.pdf` | Exact eight-digit date format in inventoried 2024–2026 links. The supplied 2026 sample URLs also follow this shape. Summer issues can combine dates. |
| Assumption group (ParishBulletins `179`), [archive](https://www.parishbulletins.com/bulletins/179/) | `https://www.parishbulletins.com/bulletins/179/<Month> <day> <year>.pdf` | Full English month, unpadded day, four-digit year. URL spaces may be literal or `%20`. One older 2014 filename has two spaces between day and year; preserve exact archive href. |
| Atonement / St. John Vianney (ParishBulletins `032`), [archive](https://www.parishbulletins.com/bulletins/032/) | `https://www.parishbulletins.com/bulletins/032/<Month> <day> <year>.pdf` | Same date-title shape in the inventory, with literal or encoded spaces. Missing Sundays and combined coverage mean not every Sunday has its own file. |
| Windsor-Lake St. Clair (`30786`), [bulletins](https://catholicfamily.ca/bulletin) | `https://files.ecatholic.com/30786/documents/YYYY/M/<uploaded title>.pdf` | Descriptive titles vary. In 2024–2026, `WLSC e-bulletin`, `WLSC Bi-Weekly Bulletin`, `WLSC Weekly Bulletin`, and compact `e-Bulletin...` forms appear. The folder can be the upload month rather than issue month. |
| West Windsor (ParishBulletins `076`), [archive](https://www.parishbulletins.com/bulletins/076/) | `https://www.parishbulletins.com/bulletins/076/<Month> <day> <year>.pdf` | Same basic date-title shape. The archive skips some Sundays, including cases where a linked issue explicitly covers two weekends. |

The five numeric eCatholic sources are `26217`, `18911`, `21089`, `20008`, and `21202`. Their shared filename shape is highly reliable for constructing a *candidate* URL, but it does not establish that the candidate exists. The two descriptive eCatholic sources (`21238`, `30786`) cannot be reduced to a dependable filename formula from these inventories.

## Descriptive eCatholic names: use extra caution

### St. Joseph, Sacred Heart, and St. Paul (`21238`)

The exact direct link is especially important for this source. The issue date, upload folder, visible archive label, and filename can disagree. Recent observations include:

- Most inventoried 2025 links are under `https://files.ecatholic.com/21238/documents/2026/1/`, despite being 2025 issues. There are also 2025 links under `/documents/2025/5/` and `/documents/2025/12/`; folder choice is not safely predictable from issue date.
- 2026 examples use unpadded month folders and plain names such as `September 27 2026.pdf`, alongside `Easter 2026.pdf` and paired dates such as `July 19  26 2026.pdf` (two spaces before `26`).
- 2025 paired/special filenames include `November_30__December_7_20251.pdf`, `December_14__21_20251.pdf`, `July_20__271.pdf`, `August_31._20251.pdf`, `Easter_-_April_20_20251.pdf`, `June_8_2025_Pentecost1.pdf`, and `April_27_2025_31.pdf`.
- Other 2025 filenames omit an expected separator/year or contain uploader typos. The archive labels `May 18, 2205` and `March 2, 205` still link to PDFs whose context identifies the 2025 issue. One archive label, “May 6, 2025,” links to a PDF whose cover says May 4.
- The 2024 archive uses more ordinary spaced titles such as `January 7 2024 2.pdf` and `July 28  August 4 2024.pdf`, as well as paired-date names with uneven spaces. Earlier years include legacy uploads stored in later folders—for example, some 2020 PDFs are in `/documents/2021/1/`.

If the exact archive href cannot be read, use only nearby, observed naming forms as search candidates: full month with spaces; underscore-separated month/date; a paired date with a double underscore or repeated month; optional year where nearby files show one; punctuation after a day; a holiday/liturgical title; or a visible numeric suffix. Inspect adjacent month/year folders only when neighboring archive links support it. Do not treat a candidate as confirmed until the PDF opens and its printed date is checked. These alternatives are a search checklist, not a claim that all variants exist.

### Windsor-Lake St. Clair (`30786`)

The folder has the form `/documents/<upload year>/<un-padded upload month>/`, but filenames are uploader-defined and shifted folders are common. The inventories show issue titles stored in the prior month’s folder and multiple title families. Recent examples include:

- `WLSC e-bulletin - February 23 2025.pdf`
- `e-BulletinMarch16th2025.pdf` (no spaces between words/date)
- `WLSC e-bulletin - May 4th 2025 - EN.pdf` (language suffix)
- `WLSC Bi-Weekly Bulletin June 22 and 29 2025 - V2.pdf`
- `WLSC Weekly Bulletin September 6 2026.pdf`
- `WLSC Weekly Bulletin August 9 and 16 2026.pdf`

Older inventory entries also include `eBulletin`, `Bulletin`, month-first titles, date ranges with `&` or `and`, ordinal day endings, and revision endings such as `-1`, `-2`, or `V2-2`. Thus, do not require a `WLSC Weekly Bulletin` prefix, a consistent date range separator, an issue-month folder, or a particular revision suffix. Prefer the exact linked name; otherwise inspect adjacent archive rows for the naming style and folder actually in use.

## ParishBulletins date filenames and exceptions

Collections `179`, `032`, and `076` share the observed recent format `<Full month> <day> <year>.pdf`, with one distinct collection ID per path. For example:

- `.../179/September%2027%202026.pdf`
- `.../032/September%2027%202026.pdf`
- `.../076/September%2027%202026.pdf`

The inventories support this form throughout 2024–2026. It is a good filename candidate when that issue is listed, but it is not a weekly-coverage guarantee. The older collection 179 inventory contains one filename with two spaces between the day and year (`November 2  2014.pdf`); older URLs should therefore also be copied exactly from their archive pages.

Known coverage exceptions found during the 2025–2026 PDF checks:

- Collection `032`: its December 21, 2025 PDF includes the December 28 Mass schedule. Its archive-linked summer PDFs also combine several Sundays; see the 2025 inventory for the date-to-file mapping.
- Collection `076`: the April 27, 2025 PDF explicitly says there is no separate May 4 bulletin and that it covers two weekends. January 5, 2025 remains unresolved in the checked archive; the January 12 PDF does not cover it.
- Collection `179`: a missing Sunday may be covered by a nearby multi-date PDF or may simply have no separately listed issue; inspect the PDF instead of inferring coverage from its title.

## Combined issues and untracked dates

An issue filename generally names its first or primary Sunday, not every Sunday covered. The inventories and PDF checks give these confirmed examples:

- Amherstburg-Harrow (`26217`), 2025: August 17 PDF covers August 17, 24, and 31; December 21 explicitly says there will be no December 28 bulletin.
- North Central Windsor (`21202`), 2025: summer PDFs combine July 6/13, July 20/27, August 3/10, and August 17/24.
- St. Joseph group (`21238`), 2025: combined titles include June 22/29, July 6/13, July 20/27, and November 30/December 7. The May 6 archive label links to the May 4 cover date.
- Windsor-Lake St. Clair (`30786`): paired issues are explicitly named in many titles, but can use `and`, `&`, repeated months, or other styles.
- South Windsor (`21089`), 2025: the December 21 PDF covers December 28. The inventory did not find separate 2026 May 24 or May 31 links.
- ParishBulletins `032`, 2025: summer gaps map to earlier combined issues; December 21 covers the December 28 Mass schedule.
- ParishBulletins `076`, 2025: April 27 covers May 4; January 5 was not found.

For untracked weeks, search the archive first, then inspect the adjacent linked PDF covers. Record a missing date as unresolved when no page-linked PDF establishes its coverage. A plausible filename, 403 response, or neighboring date alone is not evidence of a valid alternate.

## Inventory test

I tested the documented URL shapes against the direct PDF links in both master inventories, ignoring optional timestamp query strings and URL-decoding spaces for comparison. This is a structural filename test; it does **not** re-fetch the PDFs or prove that an inventory is complete.

| Source group | Links tested | Rule tested | Result |
|---|---:|---|---|
| Numeric eCatholic (`26217`, `18911`, `21089`, `20008`, `21202`) | 1,456 distinct links across the inventories | `/bulletins/` followed by exactly eight digits and `.pdf` | Every inventoried link matched. |
| ParishBulletins `179`, `032`, `076` | 1,653 distinct links across the inventories | Collection ID followed by full month, day, year, and `.pdf` | Every 2024–2026 link matched. One older `179` link has an extra space between day and year; this documented legacy exception is preserved verbatim. |
| Descriptive eCatholic (`21238`, `30786`) | 519 distinct links across the inventories | Host, collection ID, `/documents/year/month/`, and a `.pdf` filename; no fixed filename template assumed | Every inventoried link matched the broad path rule. Exact filename prediction is intentionally marked unreliable and must fall back to the archive href. |

Counts above are distinct direct PDF URLs after de-duplicating repeated appearances of the same URL in inventory tables; in 2025–2026 they include recorded retry/alternate links, so they are not counts of weeks or unique bulletin issues. The structural tests found **one legacy filename exception** (ParishBulletins `179`, 2014); there were no unexplained 2024–2026 URL shapes. Coverage gaps and combined issues are separate from filename-shape coverage and are recorded in the [2025–2026 inventory](bulletin-url-inventory-2025-2026.md) and [2026 verification](bulletin-2026-url-verification.md).
