import { useEffect, useState, type SyntheticEvent } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { useTabAccess } from '../../lib/roles';
import { PageHeader } from '../../components/PageHeader';
import { ReceiptListPanel } from './ReceiptListPanel';
import { TransferListPanel } from './TransferListPanel';

type NatureTab = 'receipts' | 'transfers';

/**
 * «دریافت و انتقال» — خزانه‌داری بخش ۴-ج (`docs/tankhah-khazaneh-module.md` §۱۰). دو تب مستقل:
 * دریافت وجه (`TB_TR_RECEIPT`) و انتقال وجه بین‌بانکی (`TB_TR_TRANSFER`) — هرکدام فهرست، فیلتر
 * وضعیت و دکمهٔ «جدید» خودش را دارد.
 */
export function ReceiptsTransfersPage() {
  const [tab, setTab] = useState<NatureTab>('receipts');
  // «دسترسی نقش‌ها»: تب بدون دسترسی دیده نمی‌شود؛ اگر تب انتخاب‌شده بسته شد، تب دیگر باز می‌شود.
  const access = useTabAccess('/treasury/khazaneh/receipts-transfers');
  const visibleTabs = (['receipts', 'transfers'] as NatureTab[]).filter((t) => access.canSee(t));
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(tab)) setTab(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.join(','), tab]);

  function handleTabChange(_event: SyntheticEvent, value: NatureTab) {
    setTab(value);
  }

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<CompareArrowsOutlinedIcon />}
        accentColor="secondary"
        title="دریافت و انتقال"
        description="ثبت دریافت وجه از مشتریان و انتقال وجه بین حساب‌های بانکی واحد."
      />

      <Tabs value={visibleTabs.includes(tab) ? tab : false} onChange={handleTabChange} sx={{ mb: 3 }}>
        {access.canSee('receipts') && <Tab value="receipts" label="دریافت وجه" />}
        {access.canSee('transfers') && <Tab value="transfers" label="انتقال وجه" />}
      </Tabs>

      {visibleTabs.includes(tab) && (tab === 'receipts' ? <ReceiptListPanel /> : <TransferListPanel />)}
    </section>
  );
}
