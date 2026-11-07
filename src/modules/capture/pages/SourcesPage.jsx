import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useGetDevicesQuery, useSetDeviceAppsMutation } from '../api/devicesApi.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { timeAgo } from '../../../platform/format.js';
import { isNativeApp, native } from '../../../platform/native.js';
import { Hero } from '../../../platform/ui/kit.jsx';
import { Spinner } from '../../../platform/ui/ui.jsx';
import SourceGrid from '../components/SourceGrid.jsx';

const Header = ({ count, sub }) => (
  <Hero>
    <h1>Sumber notifikasi</h1>
    <p>{sub ?? `${count} aplikasi dipantau · tersinkron dengan web`}</p>
  </Hero>
);

/** This phone, straight from the APK: instant and offline, no wait for the Firestore mirror. */
function ThisPhone() {
  const [apps, setApps] = useState(native.sources);
  useEffect(() => {
    const refresh = () => setApps(native.sources());
    window.addEventListener('native:resume', refresh);
    window.addEventListener('native:sources', refresh);
    return () => {
      window.removeEventListener('native:resume', refresh);
      window.removeEventListener('native:sources', refresh);
    };
  }, []);
  const selected = useMemo(() => new Set(apps.filter((a) => a.on).map((a) => a.packageName)), [apps]);
  const onToggle = useCallback((pkg, on) => {
    setApps((list) => list.map((a) => (a.packageName === pkg ? { ...a, on } : a))); // optimistic
    native.setSources([pkg], on);
  }, []);
  return (
    <>
      <Header count={selected.size} />
      <SourceGrid apps={apps} selected={selected} onToggle={onToggle} />
    </>
  );
}

/** A phone as mirrored in Firestore: the browser, or an APK older than 3.1. */
function MirroredPhone({ device, showName }) {
  const dispatch = useDispatch();
  const [setDeviceApps] = useSetDeviceAppsMutation();
  const selected = useMemo(() => new Set(device.selected || []), [device.selected]);
  const onToggle = useCallback(async (pkg, on) => {
    const res = await setDeviceApps({ deviceId: device.id, packages: [pkg], on });
    if (res.error) dispatch(notify(res.error.message, 'error'));
  }, [device.id, dispatch, setDeviceApps]);
  return (
    <section style={{ marginBottom: 18 }}>
      {showName && <h3 className="k-src-title">📱 {device.name || 'Android'} <small className="k-muted">· aktif {timeAgo(device.lastSeen)}</small></h3>}
      <SourceGrid apps={device.installedApps || []} selected={selected} onToggle={onToggle} />
    </section>
  );
}

function Mirrored() {
  const { data = [], isLoading } = useGetDevicesQuery();
  const myId = isNativeApp ? native.deviceStatus()?.deviceId : null;
  const devices = myId ? data.filter((d) => d.id === myId) : data;
  const count = devices.reduce((n, d) => n + (d.selected?.length || 0), 0);
  if (isLoading) return <><Header sub="Memuat…" /><Spinner /></>;
  return (
    <>
      <Header count={count} sub={devices.length ? undefined : 'Belum ada HP terhubung'} />
      {devices.length === 0 && (
        <div className="k-empty">
          <span className="k-emoji">📱</span>
          {isNativeApp
            ? 'Daftar aplikasi belum tersinkron. Pastikan internet aktif, lalu buka ulang aplikasinya.'
            : 'Pasang Catatanku di HP Android, lalu masuk dengan akun Google yang sama.'}
        </div>
      )}
      {devices.map((d) => <MirroredPhone key={d.id} device={d} showName={devices.length > 1} />)}
    </>
  );
}

/** "Sumber" tab: check / uncheck which apps' notifications are read. */
export default function SourcesPage() {
  return <div className="page k-page">{isNativeApp && native.hasLocalSources ? <ThisPhone /> : <Mirrored />}</div>;
}
