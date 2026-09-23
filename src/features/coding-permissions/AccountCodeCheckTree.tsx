import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UnfoldMoreOutlinedIcon from '@mui/icons-material/UnfoldMoreOutlined';
import UnfoldLessOutlinedIcon from '@mui/icons-material/UnfoldLessOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { accountCodesApi } from '../chart-of-accounts/api';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import type { AccountCodeDto } from '../../types/accountCode';
import { TreeRow } from './TreeRow';

/**
 * Chart-of-accounts levels, from `TYPE_CODE_OPTIONS`. Only level 3 (معین) rows are selectable —
 * `TB_WHITEANDBLACKLIST.ACCOUNTCODE_ID` is a permission on a معین; گروه and کل exist here as the
 * navigation spine, and ticking one is a shortcut for ticking its معین leaves.
 */
const GROUP = 1;
const KOL = 2;
const MOIN = 3;

const LEVEL_LABEL: Record<number, string> = {
  [GROUP]: 'گروه',
  [KOL]: 'کل',
  [MOIN]: 'معین',
};

/**
 * One page is enough for the whole chart: live data holds ~150 non-deleted account codes across
 * all three levels, and the backend caps `pageSize` at 200. Fetching the lot lets the tree be
 * built and searched entirely client-side, which is what a tree needs — a paged tree would hide a
 * child whose parent is on another page.
 *
 * ⚠️ If the chart ever outgrows this, the fix is a server-side tree endpoint, NOT a larger page
 * size: the backend validator rejects anything above 200 with a 400.
 */
const FETCH_PAGE_SIZE = 200;

interface TreeNode {
  account: AccountCodeDto;
  children: TreeNode[];
  /** Every selectable (معین) id at or below this node. */
  moinIds: string[];
}

export interface AccountCodeCheckTreeProps {
  /** Selected معین ids. Controlled. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Builds the گروه → کل → معین forest from the flat list.
 *
 * Rows whose `parentId` points at something not in the list are surfaced as roots rather than
 * dropped: a معین that is invisible here is one the user cannot grant, and silently losing it
 * would look like the account does not exist.
 */
function buildForest(accounts: readonly AccountCodeDto[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const account of accounts) {
    nodes.set(account.id, { account, children: [], moinIds: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.account.parentId ? nodes.get(node.account.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const collectMoinIds = (node: TreeNode): string[] => {
    const own = node.account.typeCode === MOIN ? [node.account.id] : [];
    node.moinIds = [...own, ...node.children.flatMap(collectMoinIds)];
    return node.moinIds;
  };

  const byCode = (a: TreeNode, b: TreeNode) =>
    (a.account.accCode ?? '').localeCompare(b.account.accCode ?? '');
  const sortTree = (node: TreeNode) => {
    node.children.sort(byCode);
    node.children.forEach(sortTree);
  };

  roots.sort(byCode);
  roots.forEach(sortTree);
  roots.forEach(collectMoinIds);

  return roots;
}

/** Keeps a node when it, or anything under it, matches — so a match stays reachable from its root. */
function filterForest(nodes: readonly TreeNode[], needle: string): TreeNode[] {
  if (!needle) return [...nodes];

  const lowered = needle.toLowerCase();
  const matches = (node: TreeNode) =>
    (node.account.accCode ?? '').includes(needle) ||
    (node.account.accCodeName ?? '').toLowerCase().includes(lowered);

  return nodes.flatMap((node) => {
    const children = filterForest(node.children, needle);
    if (children.length > 0 || matches(node)) {
      return [{ ...node, children }];
    }
    return [];
  });
}

function collectIdsWithChildren(nodes: readonly TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.account.id);
      collectIdsWithChildren(node.children, into);
    }
  }
  return into;
}

/**
 * The معین picker of «افزودن دسترسی جدید» — a checkbox tree over the chart of accounts.
 *
 * Ticking a گروه or کل ticks every معین beneath it, which is the only way selecting 40 معین is
 * practical and is how the reference screen behaved.
 *
 * <b>Collapsed by default.</b> ~150 rows expanded at once is a wall of text in which the three
 * levels are indistinguishable; starting at the گروه level gives roughly 28 rows and makes the
 * shape of the chart the first thing you see. Searching expands automatically, because a match
 * buried in a collapsed branch is a match the user cannot act on.
 */
export function AccountCodeCheckTree({ value, onChange }: AccountCodeCheckTreeProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const query = useQuery({
    queryKey: ['account-codes-tree'],
    queryFn: () => accountCodesApi.list({ pageNumber: 1, pageSize: FETCH_PAGE_SIZE }),
  });

  const forest = useMemo(() => buildForest(query.data?.items ?? []), [query.data]);
  const trimmedSearch = search.trim();
  const visible = useMemo(() => filterForest(forest, trimmedSearch), [forest, trimmedSearch]);
  const selected = useMemo(() => new Set(value), [value]);
  const totalMoin = useMemo(
    () => forest.reduce((sum, node) => sum + node.moinIds.length, 0),
    [forest],
  );

  function toggle(node: TreeNode, checked: boolean) {
    const next = new Set(selected);
    for (const id of node.moinIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }

  function toggleExpanded(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = expanded.size > 0;

  function renderNode(node: TreeNode, depth: number) {
    const { account, children, moinIds } = node;
    const level = account.typeCode ?? MOIN;
    const selectableCount = moinIds.length;
    const selectedCount = moinIds.filter((id) => selected.has(id)).length;
    const isChecked = selectableCount > 0 && selectedCount === selectableCount;
    const isPartial = selectedCount > 0 && !isChecked;
    // While searching, every surviving branch is shown open: a match hidden inside a collapsed
    // parent is worse than no match at all.
    const isOpen = trimmedSearch.length > 0 || expanded.has(account.id);
    const isMoin = level === MOIN;

    return (
      <Box key={account.id}>
        <TreeRow
          depth={depth}
          hasChildren={children.length > 0}
          expanded={isOpen}
          onToggleExpanded={() => toggleExpanded(account.id)}
          checked={isChecked}
          indeterminate={isPartial}
          disabled={selectableCount === 0}
          onToggleChecked={(checked) => toggle(node, checked)}
          ariaLabel={`${account.accCode ?? ''} ${account.accCodeName ?? ''}`}
        >
          <MonoCode value={account.accCode} muted={!isMoin} />
          <Typography
            variant="body2"
            noWrap
            title={account.accCodeName ?? undefined}
            sx={{
              // Weight carries the level: a گروه reads as a heading, a معین as a leaf. Without
              // this the three levels look identical and indentation alone has to do all the work.
              fontWeight: level === GROUP ? 700 : level === KOL ? 600 : 400,
              color: isMoin ? 'text.primary' : 'text.secondary',
              minWidth: 0,
            }}
          >
            {account.accCodeName ?? '—'}
          </Typography>
          {!isMoin && (
            <>
              <Chip
                size="small"
                variant="outlined"
                label={LEVEL_LABEL[level] ?? '—'}
                sx={{ height: 18, fontSize: '0.68rem', flexShrink: 0 }}
              />
              {selectedCount > 0 && (
                <Chip
                  size="small"
                  color="primary"
                  label={`${toPersianDigits(selectedCount)} از ${toPersianDigits(selectableCount)}`}
                  sx={{ height: 18, fontSize: '0.68rem', flexShrink: 0 }}
                />
              )}
            </>
          )}
        </TreeRow>

        {children.length > 0 && (
          <Collapse in={isOpen} unmountOnExit>
            {children.map((child) => renderNode(child, depth + 1))}
          </Collapse>
        )}
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      <TextField
        size="small"
        fullWidth
        label="جستجوی کد یا نام معین"
        value={search}
        onChange={(event) => setSearch(toLatinDigits(event.target.value))}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">
          {toPersianDigits(selected.size)} از {toPersianDigits(totalMoin)} معین انتخاب شده
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          color="inherit"
          startIcon={allExpanded ? <UnfoldLessOutlinedIcon /> : <UnfoldMoreOutlinedIcon />}
          onClick={() =>
            setExpanded(allExpanded ? new Set() : new Set(collectIdsWithChildren(forest)))
          }
        >
          {allExpanded ? 'بستن همه' : 'باز کردن همه'}
        </Button>
        {selected.size > 0 && (
          <Button size="small" color="inherit" onClick={() => onChange([])}>
            پاک کردن انتخاب
          </Button>
        )}
      </Stack>

      {query.isError && <ErrorBanner error={query.error} />}

      <Box
        sx={{
          maxHeight: 340,
          overflowY: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1,
        }}
      >
        {query.isLoading && (
          <Stack spacing={1}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={28} />
            ))}
          </Stack>
        )}
        {!query.isLoading && visible.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            هیچ حسابی یافت نشد.
          </Typography>
        )}
        {visible.map((node) => renderNode(node, 0))}
      </Box>
    </Stack>
  );
}
