import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetUsersQuery } from '../api/usersApi.js';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { Avatar, Spinner } from '../../../platform/ui/ui.jsx';

/** Multi-select list of registered users (excluding the current user). */
export default function UserPicker({ selected, onToggle }) {
  const me = useSelector(selectUser);
  const { data = [], isLoading } = useGetUsersQuery();
  const [q, setQ] = useState('');
  const users = useMemo(() => {
    const kw = q.toLowerCase();
    return data
      .filter((u) => u.uid !== me.uid)
      .filter((u) => !kw || `${u.displayName} ${u.email}`.toLowerCase().includes(kw));
  }, [data, q, me.uid]);
  const isSel = (uid) => selected.some((s) => s.uid === uid);

  return (
    <div className="user-picker">
      <input placeholder="Cari nama atau email..." value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? (
        <Spinner />
      ) : users.length ? (
        <ul>
          {users.map((u) => (
            <li key={u.uid}>
              <label className="user-row">
                <input type="checkbox" checked={isSel(u.uid)} onChange={() => onToggle(u)} />
                <Avatar name={u.displayName} src={u.photoURL} size={30} />
                <span>
                  {u.displayName}
                  <small className="muted"> {u.email}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Belum ada pengguna lain. Ajak teman login untuk bisa chat & split bill.</p>
      )}
    </div>
  );
}
