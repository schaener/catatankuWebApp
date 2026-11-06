import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useGetDevicesQuery, useRemoveDeviceMutation, useSetDeviceAppsMutation } from '../services/devicesApi.js';
import { notify } from '../features/ui/uiSlice.js';
import { timeAgo } from '../utils/format.js';
import { confirmAction } from '../utils/env.js';
import { EmptyState, ErrorBox, Spinner } from './ui.jsx';
import AppBadge from './AppBadge.jsx';

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={onChange}>
      <span />
    </button>
  );
}

function AppRow({ app, on, onToggle }) {
  return (
    <li className={`source-row ${on ? 'on' : ''}`}>
      <AppBadge name={app.label} />
      <div className="grow">
        <strong className="ellipsis">{app.label}</strong>
        <div className="muted small ellipsis">{app.packageName}</div>
      </div>
      <Switch checked={on} onChange={onToggle} label={`Pantau ${app.label}`} />
    </li>
  );
}

function StatusChip({ ok, good, bad }) {
  return <span className={`tag ${ok ? '' : 'tag-warn'}`}>{ok ? `✓ ${good}` : `! ${bad}`}</span>;
}

function DeviceCard({ device }) {
  const dispatch = useDispatch();
  const [setApps] = useSetDeviceAppsMutation();
  const [remove] = useRemoveDeviceMutation();
  const [query, setQuery] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const selected = new Set(device.selected || []);
  const apps = (device.installedApps || []).filter(
    (a) => !query || `${a.label} ${a.packageName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const finance = apps.filter((a) => a.suggested);
  const others = apps.filter((a) => !a.suggested);
  const onCount = (device.installedApps || []).filter((a) => selected.has(a.packageName)).length;

  const toggle = async (packages, on) => {
    const res = await setApps({ deviceId: device.id, packages, on });
    if (res.error) dispatch(notify(res.error.message, 'error'));
  };
  const row = (a) => <AppRow key={a.packageName} app={a} on={selected.has(a.packageName)} onToggle={() => toggle([a.packageName], !selected.has(a.packageName))} />;

  return (
    <section className="card device-card">
      <header className="device-head">
        <span className="device-icon">📱</span>
        <div className="grow">
          <strong>{device.name || 'Android'}</strong>
          <div className="muted small">
            Android {device.osVersion} · Catatanku Auto {device.appVersion} · aktif {timeAgo(device.lastSeen)}
          </div>
        </div>
        <button className="icon-btn" title="Hapus perangkat ini" onClick={() => confirmAction(`Hapus ${device.name} dari daftar?`) && remove(device.id)}>
          🗑️
        </button>
      </header>
      <div className="review-meta">
        <StatusChip ok={device.listenerEnabled} good="Akses notifikasi aktif" bad="Akses notifikasi belum diizinkan" />
        <StatusChip ok={device.batteryUnrestricted} good="Baterai tidak dibatasi" bad="Optimasi baterai masih aktif" />
        <span className="tag">{onCount} aplikasi dipantau</span>
      </div>
      <div className="filter-row">
        <input className="grow" placeholder="Cari aplikasi…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="source-section-head">
        <h3>Bank & e-wallet terdeteksi</h3>
        {finance.length > 0 && (
          <div className="inline">
            <button className="btn btn-ghost" onClick={() => toggle(finance.map((a) => a.packageName), true)}>
              Nyalakan semua
            </button>
            <button className="btn btn-ghost" onClick={() => toggle(finance.map((a) => a.packageName), false)}>
              Matikan semua
            </button>
          </div>
        )}
      </div>
      {finance.length ? <ul className="source-list">{finance.map(row)}</ul> : <p className="muted small">Tidak ada yang cocok.</p>}

      <button className="link-btn left source-more" onClick={() => setShowOthers((s) => !s)}>
        {showOthers || query ? '▾' : '▸'} Aplikasi lain ({others.length})
      </button>
      {(showOthers || query) && <ul className="source-list">{others.map(row)}</ul>}
    </section>
  );
}

/** Per-phone on/off switches for which apps the Android listener captures. */
export default function DeviceSources() {
  const { data = [], isLoading, error } = useGetDevicesQuery();
  if (isLoading) return <Spinner />;
  return (
    <>
      <ErrorBox error={error} />
      <p className="muted">
        Pilih aplikasi yang notifikasinya dicatat. Perubahan langsung berlaku di HP, dan sebaliknya: yang kamu ubah di HP juga
        muncul di sini.
      </p>
      {!data.length ? (
        <EmptyState icon="📱" title="Belum ada HP terhubung">
          Pasang aplikasi <strong>Catatanku Auto</strong> di HP Android, lalu masuk dengan akun Google yang sama.
        </EmptyState>
      ) : (
        data.map((d) => <DeviceCard key={d.id} device={d} />)
      )}
    </>
  );
}
