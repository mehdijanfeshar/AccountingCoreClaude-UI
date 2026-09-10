import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <section>
      <h1>سیستم حسابداری</h1>
      <p>یکی از گزینه‌های منوی سمت راست را انتخاب کنید.</p>
      <ul>
        <li>
          <Link to="/base/account-codes">کدینگ حسابداری</Link>
        </li>
        <li>
          <Link to="/operation/voucher-heads">اسناد حسابداری</Link>
        </li>
      </ul>
    </section>
  );
}
