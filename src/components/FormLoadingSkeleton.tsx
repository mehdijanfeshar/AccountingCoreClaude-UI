import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Shape-matched loading placeholder for a page-level entity form (header + card + field rows),
 * used while an edit-mode form's record is being fetched. Replaces a bare spinner+text row —
 * a plain spinner reads as "something might be broken", a skeleton reads as "content is coming".
 */
export function FormLoadingSkeleton() {
  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: 'flex-start' }}>
        <Skeleton variant="rounded" width={44} height={44} />
        <Box sx={{ flexGrow: 1, pt: 0.5 }}>
          <Skeleton width="20%" height={14} sx={{ mb: 0.5 }} />
          <Skeleton width="40%" height={26} />
        </Box>
      </Stack>
      <Paper variant="outlined" sx={{ p: 3, borderTop: 4, borderTopColor: 'divider' }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={3}>
            <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={56} sx={{ flex: 2 }} />
          </Stack>
          <Skeleton variant="rounded" height={56} />
          <Stack direction="row" spacing={3}>
            <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
            <Skeleton variant="rounded" width={90} height={36} />
            <Skeleton variant="rounded" width={110} height={36} />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
