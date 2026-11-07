import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../../platform/constants.js';
import { parseDateStr, toDateStr, todayStr } from '../../../platform/date.js';
import { useAddTransactionMutation, useUpdateTransactionMutation } from '../api/transactionsApi.js';
import { notify } from '../../../platform/ui/uiSlice.js';

export default function TransactionForm({ initial, onDone }) {
  const dispatch = useDispatch();
  const [add, addState] = useAddTransactionMutation();
  const [update, updateState] = useUpdateTransactionMutation();
  const [form, setForm] = useState(() => ({
    type: initial?.type || 'expense',
    amount: initial?.amount ?? '',
    category: initial?.category || EXPENSE_CATEGORIES[0],
    place: initial?.place || '',
    paymentMethod: initial?.paymentMethod || PAYMENT_METHODS[0],
    note: initial?.note || '',
    date: initial?.date ? toDateStr(initial.date) : todayStr(),
  }));
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return dispatch(notify('Jumlah harus lebih dari 0', 'error'));
    // keep the current time-of-day for ordering within a day
    const d = parseDateStr(form.date);
    const now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    const payload = { ...form, date: initial?.date && toDateStr(initial.date) === form.date ? initial.date : d.getTime() };
    const res = initial?.id ? await update({ id: initial.id, ...payload }) : await add(payload);
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    dispatch(notify(initial?.id ? 'Transaksi diperbarui' : 'Transaksi disimpan', 'success'));
    onDone?.();
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="segmented">
        {[
          ['expense', 'Pengeluaran'],
          ['income', 'Pemasukan'],
        ].map(([v, label]) => (
          <button
            type="button"
            key={v}
            className={form.type === v ? `active ${v}` : ''}
            onClick={() =>
              setForm((f) => ({ ...f, type: v, category: (v === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] }))
            }
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        Jumlah (Rp)
        <input type="number" inputMode="numeric" min="1" required value={form.amount} onChange={set('amount')} autoFocus />
      </label>
      <div className="grid-2">
        <label>
          Kategori
          <select value={form.category} onChange={set('category')}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Tanggal
          <input type="date" required value={form.date} onChange={set('date')} />
        </label>
      </div>
      <div className="grid-2">
        <label>
          {form.type === 'income' ? 'Sumber' : 'Tempat / dibelanjakan di'}
          <input
            placeholder={form.type === 'income' ? 'mis. Kantor' : 'mis. Indomaret Kemang'}
            value={form.place}
            onChange={set('place')}
            list="place-suggestions"
          />
        </label>
        <label>
          Metode
          <select value={form.paymentMethod} onChange={set('paymentMethod')}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Catatan
        <textarea rows={2} value={form.note} onChange={set('note')} placeholder="Opsional" />
      </label>
      <button className="btn btn-primary" disabled={addState.isLoading || updateState.isLoading}>
        {addState.isLoading || updateState.isLoading ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  );
}
