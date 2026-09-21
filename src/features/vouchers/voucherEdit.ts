import { voucherDetailsApi } from './api';
import type { CreateVoucherDetailPayload } from './api';
import { createEmptyVoucherLine, type VoucherLineFormValue } from './voucherFormTypes';
import type { VoucherDetailDto } from '../../types/voucherDetail';
import type { VoucherHeadDto } from '../../types/voucherHead';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';

/**
 * Loading an existing voucher into the entry form, and saving it back.
 *
 * <b>The hard part is not the form, it is the reconcile.</b> Creating a voucher only ever adds
 * rows. Editing one has to work out, for every line the user ended up with, whether it is a row
 * that already exists, a row that is new, or — for rows that are no longer on screen — a row that
 * has to be deleted. Getting that wrong does not look like a bug: it looks like a voucher that
 * quietly gained a duplicate line or lost one.
 */

/** Maps a form row's client-side `key` to the `TB_VOUCHERSDETAIL.ID` it came from. */
export type DetailIdByRowKey = Record<string, string>;

/**
 * The line rows exactly as they were loaded, keyed by form row.
 *
 * <b>Needed because the update path replaces rather than patches.</b> The handler assigns every
 * column it accepts, unconditionally, so a field left out of the payload is not "unchanged" — it
 * is set to null. This form edits five of a line's columns; the rest (RECEIP_ID, CHECK_ID,
 * LOWLEVELCODE_ID, ETEBAR_ID and RADIF, the line's own ordering number) have to be sent back
 * untouched or they are destroyed by an edit that never mentioned them.
 */
export type OriginalDetailByRowKey = Record<string, VoucherDetailDto>;

export interface LoadedVoucher {
  values: VoucherEntryFormSchema;
  detailIds: DetailIdByRowKey;
  originals: OriginalDetailByRowKey;
}

/**
 * Thrown when a loaded line has no `tafsiliLinks` field at all.
 *
 * <b>This is a version mismatch, not missing data, and the difference is the whole reason this
 * exists.</b> An empty array means "this line has no تفصیلی". An absent field means the API
 * predates the field and cannot tell us either way. Treating the second as the first would be
 * quietly destructive: the update path always sends a list, so saving would clear every تفصیلی
 * assignment on every line of the voucher, and nothing would report an error.
 *
 * So the form refuses to load rather than opening in a state where the save button destroys data.
 */
export class VoucherApiTooOldError extends Error {
  constructor() {
    super(
      'سرویس بک‌اند نسخهٔ قدیمی‌تری است و تفصیلی ردیف‌های سند را برنمی‌گرداند. ' +
        'ویرایش در این حالت باعث پاک‌شدن تفصیلی‌ها می‌شود، بنابراین فرم باز نمی‌شود. ' +
        'لطفاً سرویس را با آخرین نسخه اجرا کنید.',
    );
    this.name = 'VoucherApiTooOldError';
  }
}

/**
 * Turns a head plus its lines into form values.
 *
 * Labels come from the server rather than being looked up here: `accountLabel` and the تفصیلی
 * labels are what the controls display, so a blank one reads as "nothing selected" even when an
 * id is set underneath.
 */
export function toFormValues(
  head: VoucherHeadDto,
  details: VoucherDetailDto[],
  accountLabelById: (id: string | null) => string,
): LoadedVoucher {
  const detailIds: DetailIdByRowKey = {};
  const originals: OriginalDetailByRowKey = {};

  // Checked before anything is mapped, so the form never half-loads.
  if (details.some((detail) => !Array.isArray(detail.tafsiliLinks))) {
    throw new VoucherApiTooOldError();
  }

  const lines: VoucherLineFormValue[] = details.map((detail) => {
    const line = createEmptyVoucherLine();
    detailIds[line.key] = detail.id;
    originals[line.key] = detail;

    const tafsili: Record<string, string> = {};
    const tafsiliLabels: Record<string, string> = {};
    detail.tafsiliLinks.forEach((link) => {
      tafsili[link.levelId] = link.tafsiliId;
      // A link whose تفصیلی no longer exists comes back with a null name (TAFSILI_ID has no
      // foreign key). Showing the bare id is ugly, but it is visible — and visible beats a blank
      // box that looks like nothing was ever assigned.
      tafsiliLabels[link.levelId] = link.tafsiliName ? link.label : `شناسهٔ نامعتبر: ${link.tafsiliId}`;
    });

    return {
      ...line,
      accountId: detail.accountId ?? '',
      accountLabel: accountLabelById(detail.accountId),
      description: detail.description ?? '',
      debtor: detail.debtor ? String(detail.debtor) : '',
      creditor: detail.creditor ? String(detail.creditor) : '',
      tafsili,
      tafsiliLabels,
    };
  });

  return {
    detailIds,
    originals,
    values: {
      docNum: head.docNum ?? '',
      dateDoc: head.dateDoc ?? '',
      year: head.year ?? '',
      headDesc: head.headDesc ?? '',
      apendix: head.apendix ?? '',
      // A voucher with no lines would leave the form with nothing to edit, so it gets one blank
      // row — new, not a phantom of a row that exists.
      lines: lines.length > 0 ? lines : [createEmptyVoucherLine()],
    },
  };
}

/**
 * @param original The row as loaded, when this line already exists. Its columns are carried
 * through untouched — the update path replaces rather than patches, so anything omitted is set to
 * null rather than left alone. `RADIF` matters most here: it is the line's ordering number, and
 * nulling it would silently reshuffle the voucher.
 */
function buildPayload(
  headId: string,
  line: VoucherLineFormValue,
  year: string,
  original?: VoucherDetailDto,
): CreateVoucherDetailPayload {
  const tafsiliEntries = Object.entries(line.tafsili ?? {}).filter(([, tafsiliId]) => Boolean(tafsiliId));

  return {
    voucherHeadId: headId,
    accountId: line.accountId || null,
    receiptId: original?.receiptId ?? null,
    checkId: original?.checkId ?? null,
    lowLevelCodeId: original?.lowLevelCodeId ?? null,
    etebarId: original?.etebarId ?? null,
    description: line.description?.trim() ? line.description.trim() : null,
    radif: original?.radif ?? null,
    debtor: line.debtor ? Number(line.debtor) : null,
    creditor: line.creditor ? Number(line.creditor) : null,
    year: year || null,
    // ⚠️ Always a list on the update path, never null, and that is the whole point. The backend
    // reads null as "leave the existing links alone" — which would be wrong here, because the user
    // may have just cleared a تفصیلی or changed the account the old ones belonged to. An empty
    // list says "this line has none", which is what the form actually means.
    tafsiliLinks: tafsiliEntries.map(([levelId, tafsiliId]) => ({ tafsiliId, levelId })),
  };
}

export interface ReconcileResult {
  failed: { key: string; message: string }[];
}

/**
 * Brings the stored lines in line with the lines on screen.
 *
 * Deletes run first. A voucher's lines are effectively identified by what they say, and doing the
 * removals before the inserts keeps the document from momentarily holding both an old line and its
 * replacement — which matters because this runs as several requests, not one transaction (open
 * risk #21), so "momentarily" is a state someone can actually observe if a later call fails.
 */
export async function reconcileLines(
  headId: string,
  lines: VoucherLineFormValue[],
  detailIds: DetailIdByRowKey,
  originals: OriginalDetailByRowKey,
  year: string,
): Promise<ReconcileResult> {
  const failed: ReconcileResult['failed'] = [];

  const survivingKeys = new Set(lines.map((line) => line.key));
  const removedIds = Object.entries(detailIds)
    .filter(([key]) => !survivingKeys.has(key))
    .map(([, id]) => id);

  for (const id of removedIds) {
    try {
      await voucherDetailsApi.remove(id);
    } catch (error) {
      failed.push({
        key: id,
        message: error instanceof Error ? error.message : 'حذف ردیف با خطا مواجه شد.',
      });
    }
  }

  for (const line of lines) {
    const existingId = detailIds[line.key];
    try {
      if (existingId) {
        await voucherDetailsApi.update(existingId, buildPayload(headId, line, year, originals[line.key]));
      } else {
        await voucherDetailsApi.create(buildPayload(headId, line, year));
      }
    } catch (error) {
      failed.push({
        key: line.key,
        message: error instanceof Error ? error.message : 'ثبت ردیف با خطا مواجه شد.',
      });
    }
  }

  return { failed };
}
