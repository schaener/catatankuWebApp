import { Link } from 'react-router-dom';
import { isNativeApp, native } from '../../../platform/native.js';
import { Hero, Section } from '../../../platform/ui/kit.jsx';
import { useSetupProgress } from '../logic/setup.js';

/** Phone setup checklist (Android app only). Which apps are read lives in the "Sumber" tab. */
export default function DevicePage() {
  const { status, steps } = useSetupProgress();
  const active = status && status.listener && status.sources > 0;
  return (
    <div className="page k-page">
      <Hero>
        <h1>Pengaturan HP</h1>
        <p>{isNativeApp ? `${status?.device ?? 'HP ini'} · Catatanku ${status?.appVersion ?? ''}` : 'Aplikasi Android yang membaca notifikasi bank & e-wallet'}</p>
        {isNativeApp && (
          <div className={`k-pill ${active ? '' : 'off'}`}>
            <i />
            {active ? `Aktif membaca ${status.sources} aplikasi` : 'Belum aktif. Selesaikan pengaturan di bawah'}
          </div>
        )}
      </Hero>

      {isNativeApp ? (
        <Section title="Biar tetap jalan, walau HP direstart">
          <div className="k-card flush">
            {steps.map((st) => (
              <div key={st.title} className="k-row" style={{ cursor: 'default' }}>
                <span className="k-avatar" style={{ width: 34, height: 34, borderRadius: 17, background: st.done ? 'var(--primary-soft)' : '#fef3c7', color: st.done ? 'var(--good)' : 'var(--warn)', fontSize: 16 }}>
                  {st.done ? '✓' : '!'}
                </span>
                <div className="k-main">
                  <div className="k-title">{st.title}</div>
                  <div className="k-meta" style={{ whiteSpace: 'normal' }}>{st.sub}</div>
                </div>
                {!st.done && (st.to
                  ? <Link to={st.to} className="k-btn primary">{st.action}</Link>
                  : <button type="button" className="k-btn primary" onClick={st.run}>{st.action}</button>)}
              </div>
            ))}
          </div>
          <div className="k-actions" style={{ marginTop: 10 }}>
            <button type="button" className="k-btn" onClick={native.postTestNotification}>🔔 Kirim notifikasi uji</button>
            <button type="button" className="k-btn" onClick={native.flush}>↻ Kirim ulang antrian</button>
          </div>
        </Section>
      ) : (
        <div className="k-empty" style={{ marginTop: 16 }}>
          <span className="k-emoji">📱</span>
          Pasang <b>Catatanku</b> di HP Android lalu masuk dengan akun yang sama. Pilih aplikasi yang dibaca di tab <Link to="/sources">Sumber</Link>.
        </div>
      )}
    </div>
  );
}
