import { useState, type SyntheticEvent } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
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

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab value="receipts" label="دریافت وجه" />
        <Tab value="transfers" label="انتقال وجه" />
      </Tabs>

      {tab === 'receipts' ? <ReceiptListPanel /> : <TransferListPanel />}
    </section>
  );
}
