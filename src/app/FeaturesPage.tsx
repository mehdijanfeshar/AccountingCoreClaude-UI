import { useEffect, useState, type SyntheticEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { PageHeader } from '../components/PageHeader';
import { toPersianDigits } from '../lib/format/numbers';
import { identityGroupsApi } from '../features/identity/api';
import { IdentityGroupsTab } from '../features/identity/IdentityGroupsTab';
import { IdentitySubGroupsTab } from '../features/identity/IdentitySubGroupsTab';
import { IdentityHeadsTab } from '../features/identity/IdentityHeadsTab';

const TABS = ['groups', 'parts', 'records'] as const;
type TabKey = (typeof TABS)[number];

/** The group dropdowns need every group, not a page of them; units rarely have many. */
const GROUP_PAGE_SIZE = 200;

/** Tab label with its optional row count, mirroring `AccountCodingPage`. */
function TabLabel({ text, count }: { text: string; count?: number }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      {count !== undefined && (
        <Chip
          label={toPersianDigits(count)}
          size="small"
          sx={{ height: 20, minWidth: 28, fontSize: '0.7rem', bgcolor: 'action.selected' }}
        />
      )}
    </Stack>
  );
}

/**
 * ۳-تب «ویژگی» — the same shape as `AccountCodingPage`, and for the same reason: these are three
 * levels of one concept, not three unrelated screens.
 *
 * <b>Why one menu entry and not two.</b> The reference Angular app keeps all of this under a
 * single «تعریف ویژگی» menu item (`base-feature`), with the record pages sitting inside that same
 * folder. Splitting گروه/اجزا from the records — as this app briefly did — made two sibling menu
 * entries out of one workflow: you define a گروه, define its اجزا, then record values against it.
 *
 * <b>On the naming.</b> The Oracle columns call all of this شناسنامه, and `docs/…-reference.md`
 * §۲۵ in the backend repo keeps that mapping. The UI deliberately says ویژگی instead, because
 * that is the word the existing users know from the old system. ⚠️ Not to be confused with
 * «حساب‌های شناسه‌دار» (`TB_ATTRIBFORACCOUNTCODE`) — a genuinely separate mechanism.
 */
export function FeaturesPage() {
  const [tab, setTab] = useState<TabKey>('groups');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const groupsQuery = useQuery({
    queryKey: ['identity-groups', 'all'],
    queryFn: () => identityGroupsApi.list({ pageNumber: 1, pageSize: GROUP_PAGE_SIZE }),
  });
  const groups = groupsQuery.data?.items ?? [];

  // Default the parts tab to the first group so it is never pointlessly empty, but never override
  // a group the user picked themselves (or arrived on via the groups tab).
  useEffect(() => {
    if (selectedGroupId || groups.length === 0) return;
    setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  function handleChange(_event: SyntheticEvent, value: TabKey) {
    setTab(value);
  }

  /** Jumping from a group row straight to that group's اجزا — the natural next step. */
  function openPartsOf(groupId: string) {
    setSelectedGroupId(groupId);
    setTab('parts');
  }

  const tabIconSx = { mb: '0 !important', mr: 0, ml: 1 } as const;

  return (
    <Box>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<TuneOutlinedIcon />}
        title="ویژگی"
        description="ابتدا گروه ویژگی و اجزای آن را تعریف کنید؛ سپس ویژگی با فیلدهای داینامیکِ همان اجزا ثبت می‌شود."
      />

      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
        <Tabs value={tab} onChange={handleChange} variant="scrollable" scrollButtons="auto">
          <Tab
            value="groups"
            iconPosition="start"
            icon={<AccountTreeOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="گروه ویژگی" count={groupsQuery.isLoading ? undefined : groups.length} />}
          />
          <Tab
            value="parts"
            iconPosition="start"
            icon={<ListAltOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="اجزای ویژگی" />}
          />
          <Tab
            value="records"
            iconPosition="start"
            icon={<FactCheckOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="ویژگی‌های ثبت‌شده" />}
          />
        </Tabs>
      </Paper>

      {tab === 'groups' && <IdentityGroupsTab onOpenParts={openPartsOf} />}

      {tab === 'parts' && (
        <IdentitySubGroupsTab
          groups={groups}
          groupsLoading={groupsQuery.isLoading}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
        />
      )}

      {tab === 'records' && <IdentityHeadsTab groups={groups} groupsLoading={groupsQuery.isLoading} />}
    </Box>
  );
}
