import { Link } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';

export function HomePage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h1" component="h1">
        سیستم حسابداری
      </Typography>
      <Typography color="text.secondary">یکی از گزینه‌های منوی سمت راست را انتخاب کنید.</Typography>
      <Paper variant="outlined" sx={{ maxWidth: 360 }}>
        <List>
          <ListItemButton component={Link} to="/base/account-codes">
            <ListItemText primary="کدینگ حسابداری" />
          </ListItemButton>
          <ListItemButton component={Link} to="/operation/voucher-heads">
            <ListItemText primary="اسناد حسابداری" />
          </ListItemButton>
        </List>
      </Paper>
    </Stack>
  );
}
