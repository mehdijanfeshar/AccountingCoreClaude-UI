import { useMemo, useState, type DragEvent } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MonoCode } from '../../components/MonoCode';
import { FS_ROW_TYPE, FS_ROW_TYPE_OPTIONS, labelOf, type FsTemplateRowDto } from '../../types/fsTemplate';

type DropPos = 'before' | 'after' | 'inside' | 'end';

export interface FsRowMove {
  rowIds: string[];
  parentChanges: { rowId: string; parentCode: string | null }[];
}

/**
 * جابه‌جایی ردیف `dragId` با همهٔ زیرمجموعه‌اش (به همان ترتیب نسبی) کنار/درون `targetId`.
 * «درون» فقط برای عنوان و اولین فرزند می‌شود؛ «انتها» = آخر نسخه در ریشه. `null` = جابه‌جایی نامعتبر یا بی‌اثر.
 */
export function computeFsRowMove(
  rows: FsTemplateRowDto[],
  dragId: string,
  targetId: string | null,
  pos: DropPos,
): FsRowMove | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const drag = byId.get(dragId);
  if (!drag) return null;

  const block = new Set<string>([dragId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && block.has(r.parentId) && !block.has(r.id)) {
        block.add(r.id);
        grew = true;
      }
    }
  }
  if (targetId && block.has(targetId)) return null;

  const target = targetId ? byId.get(targetId) : undefined;
  if (pos !== 'end' && !target) return null;
  if (pos === 'inside' && target!.rowType !== FS_ROW_TYPE.Header) return null;

  const moving = rows.filter((r) => block.has(r.id)).map((r) => r.id);
  const rest = rows.filter((r) => !block.has(r.id)).map((r) => r.id);
  const at = pos === 'end' ? rest.length : rest.indexOf(targetId!) + (pos === 'before' ? 0 : 1);
  const rowIds = [...rest.slice(0, at), ...moving, ...rest.slice(at)];

  const newParentCode = pos === 'end' ? null : pos === 'inside' ? target!.code : target!.parentCode;
  const parentChanges = (drag.parentCode ?? null) === newParentCode ? [] : [{ rowId: dragId, parentCode: newParentCode }];

  const sameOrder = rowIds.every((id, i) => id === rows[i].id);
  return sameOrder && parentChanges.length === 0 ? null : { rowIds, parentChanges };
}

interface Props {
  rows: FsTemplateRowDto[];
  editable: boolean;
  busy: boolean;
  issuesByRow: Map<string, number>;
  onMove: (move: FsRowMove) => void;
  onEdit: (row: FsTemplateRowDto) => void;
  onDelete: (row: FsTemplateRowDto) => void;
}

/**
 * طراح درختی قالب (بخش ۴۵-و): ردیف را با دستگیره بکشید و روی ردیف دیگر رها کنید — نیمهٔ بالا = پیش از آن،
 * نیمهٔ پایینِ «عنوان» = اولین زیرمجموعه‌اش، نیمهٔ پایینِ بقیه = پس از آن. زیرمجموعه‌ها همراه والد جابه‌جا می‌شوند.
 */
export function FsTemplateTreeDesigner({ rows, editable, busy, issuesByRow, onMove, onEdit, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string | null; pos: DropPos } | null>(null);

  const { depthById, hasChildren, hidden } = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const depth = new Map<string, number>();
    const parents = new Set<string>();
    const hide = new Set<string>();
    for (const r of rows) {
      let d = 0;
      for (let p = r.parentId; p && d < 10; p = byId.get(p)?.parentId ?? null) {
        d++;
        if (collapsed.has(p)) hide.add(r.id);
      }
      depth.set(r.id, d);
      if (r.parentId) parents.add(r.parentId);
    }
    return { depthById: depth, hasChildren: parents, hidden: hide };
  }, [rows, collapsed]);

  const canDrag = editable && !busy;

  function posFor(e: DragEvent<HTMLElement>, row: FsTemplateRowDto): DropPos {
    const rect = e.currentTarget.getBoundingClientRect();
    const upper = e.clientY - rect.top < rect.height / 2;
    if (upper) return 'before';
    return row.rowType === FS_ROW_TYPE.Header ? 'inside' : 'after';
  }

  function onDragOver(e: DragEvent<HTMLElement>, row: FsTemplateRowDto | null) {
    if (!dragId) return;
    const pos = row ? posFor(e, row) : 'end';
    if (!computeFsRowMove(rows, dragId, row?.id ?? null, pos)) {
      if (hover) setHover(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hover?.id !== (row?.id ?? null) || hover?.pos !== pos) setHover({ id: row?.id ?? null, pos });
  }

  function onDrop(e: DragEvent<HTMLElement>, row: FsTemplateRowDto | null) {
    e.preventDefault();
    const move = dragId ? computeFsRowMove(rows, dragId, row?.id ?? null, row ? posFor(e, row) : 'end') : null;
    setDragId(null);
    setHover(null);
    if (move) {
      if (row && posFor(e, row) === 'inside') setCollapsed((c) => (c.has(row.id) ? new Set([...c].filter((x) => x !== row.id)) : c));
      onMove(move);
    }
  }

  function toggle(id: string) {
    setCollapsed((c) => {
      const next = new Set(c);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">این نسخه هنوز ردیفی ندارد.</Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', opacity: busy ? 0.7 : 1 }}>
      {editable && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          ردیف را با دستگیره بکشید: نیمهٔ بالای ردیف مقصد = پیش از آن؛ نیمهٔ پایینِ «عنوان» = زیرمجموعهٔ آن؛ نیمهٔ پایینِ بقیه =
          پس از آن. زیرمجموعه‌ها همراه والد می‌روند. توجه: فرمول‌های بازه‌ای مثل SUM(a:b) بر ترتیب ردیف‌ها تکیه دارند.
        </Typography>
      )}
      <Box role="tree" aria-label="درخت ردیف‌های قالب">
        {rows.map((r) => {
          if (hidden.has(r.id)) return null;
          const depth = depthById.get(r.id) ?? 0;
          const sev = issuesByRow.get(r.code);
          const isHeader = r.rowType === FS_ROW_TYPE.Header;
          const isHover = hover?.id === r.id;
          const isDragging = dragId === r.id;
          return (
            <Box
              key={r.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={hasChildren.has(r.id) ? !collapsed.has(r.id) : undefined}
              draggable={canDrag}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', r.code);
                setDragId(r.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setHover(null);
              }}
              onDragOver={(e) => onDragOver(e, r)}
              onDrop={(e) => onDrop(e, r)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 40,
                px: 1,
                pr: 1 + depth * 3,
                borderBottom: 1,
                borderColor: 'divider',
                borderTop: isHover && hover?.pos === 'before' ? '2px solid' : undefined,
                borderBottomColor: isHover && hover?.pos === 'after' ? 'primary.main' : 'divider',
                borderBottomWidth: isHover && hover?.pos === 'after' ? 2 : 1,
                borderTopColor: 'primary.main',
                bgcolor: isHover && hover?.pos === 'inside' ? 'action.selected' : isHeader ? 'action.hover' : undefined,
                opacity: isDragging ? 0.4 : 1,
                cursor: canDrag ? 'grab' : 'default',
              }}
            >
              {canDrag && <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              <Box sx={{ width: 28, flexShrink: 0 }}>
                {hasChildren.has(r.id) && (
                  <IconButton size="small" aria-label={collapsed.has(r.id) ? 'باز کردن' : 'بستن'} onClick={() => toggle(r.id)}>
                    {collapsed.has(r.id) ? <ChevronLeftIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                )}
              </Box>
              <MonoCode value={r.code} />
              {sev && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sev === 2 ? 'error.main' : 'warning.main' }} />}
              <Typography
                variant="body2"
                noWrap
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: isHeader || r.format.bold ? 700 : 400,
                  color: r.rowType === FS_ROW_TYPE.Blank ? 'text.disabled' : undefined,
                }}
              >
                {r.titleFa || (r.rowType === FS_ROW_TYPE.Blank ? '(ردیف خالی)' : '—')}
              </Typography>
              {(r.selector || r.formula) && (
                <Typography
                  variant="caption"
                  dir="ltr"
                  noWrap
                  sx={{ fontFamily: 'monospace', color: 'text.secondary', maxWidth: 240, display: { xs: 'none', md: 'block' } }}
                >
                  {r.selector ?? r.formula}
                </Typography>
              )}
              <Chip size="small" variant="outlined" label={labelOf(FS_ROW_TYPE_OPTIONS, r.rowType)} />
              {editable && (
                <Stack direction="row" spacing={0}>
                  <Tooltip title="ویرایش">
                    <IconButton size="small" color="primary" onClick={() => onEdit(r)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="حذف">
                    <IconButton size="small" color="error" onClick={() => onDelete(r)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>
          );
        })}
        {canDrag && (
          <Box
            onDragOver={(e) => onDragOver(e, null)}
            onDrop={(e) => onDrop(e, null)}
            sx={{
              minHeight: 40,
              display: dragId ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed',
              borderColor: hover?.pos === 'end' ? 'primary.main' : 'divider',
              m: 1,
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              رها کنید تا به انتهای قالب (بدون والد) برود
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
