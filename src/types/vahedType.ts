/**
 * `TB_VAHED_TYPE` — the organizational unit types (`GET /api/vahed-types`, unpaged).
 * Mirrors `backend/src/Accounting.Application/VahedTypes/Queries/VahedTypeDto.cs`.
 */
export interface VahedTypeDto {
  id: string;
  typeCode: string | null;
  typeName: string | null;
  /** The «بخش» bucket this type belongs to. See `VAHED_SECTION_LABELS` below. */
  parentTypeCode: string | null;
}

/**
 * Display names for the three «بخش» buckets `parentTypeCode` takes.
 *
 * ⚠️ **This mapping is an inference, and it is the one thing on this screen not read from a
 * table.** `PARENTTYPECODE` is a bare string with no lookup anywhere in the `CENTRALACCOUNT`
 * schema, and the reference project's own tree endpoint (`GetVahedTypeQueryTreeHandler`) returns
 * the bucket unlabelled — it sets `label = mainGroup.Key` and no display value. The names below
 * come from two independent sources that agree:
 *
 * - The Figma design for this screen shows exactly three buckets named ستاد / درمان / بیمه.
 * - Matching them to live data by **membership** (not by the mock's numbering, which differs):
 *   bucket `"1"` holds {اداره کل, شعبه} = بیمه, bucket `"2"` holds the clinical types = درمان,
 *   bucket `"3"` holds {خزانه, ذخایر, پرسنلی ستاد, غیرپرسنلی, ترازنامه, ستاد مرکزی} = ستاد.
 * - The reference project's own unit test carries the comment `SetParentTypeCode("2"); // درمان`,
 *   which independently confirms bucket 2.
 *
 * A code that is not one of the three falls back to «بخش {code}» rather than throwing or showing
 * nothing, so a new bucket appearing in the shared schema degrades visibly instead of silently.
 * Recorded as an open assumption in the backend repo's `docs/open-decisions.md`.
 */
export const VAHED_SECTION_LABELS: Record<string, string> = {
  '1': 'بیمه',
  '2': 'درمان',
  '3': 'ستاد',
};

export function getVahedSectionLabel(parentTypeCode: string | null | undefined): string {
  if (!parentTypeCode) return 'بدون بخش';
  return VAHED_SECTION_LABELS[parentTypeCode] ?? `بخش ${parentTypeCode}`;
}

/** One «بخش» with the unit types under it — the shape the picker tree renders. */
export interface VahedTypeSection {
  parentTypeCode: string;
  label: string;
  types: VahedTypeDto[];
}

/**
 * Groups a flat unit-type list into its «بخش» buckets, preserving the server's ordering
 * (`PARENTTYPECODE`, then `TYPECODE`) rather than re-sorting.
 */
export function groupVahedTypesBySection(types: readonly VahedTypeDto[]): VahedTypeSection[] {
  const sections = new Map<string, VahedTypeSection>();

  for (const type of types) {
    const key = type.parentTypeCode ?? '';
    let section = sections.get(key);
    if (!section) {
      section = { parentTypeCode: key, label: getVahedSectionLabel(type.parentTypeCode), types: [] };
      sections.set(key, section);
    }
    section.types.push(type);
  }

  return [...sections.values()];
}
