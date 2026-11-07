export default function SetupRequired() {
  return (
    <div className="login">
      <div className="login-card card" style={{ textAlign: 'left' }}>
        <h1>Konfigurasi Firebase diperlukan</h1>
        <ol>
          <li>Buat project di Firebase Console dan tambahkan Web App.</li>
          <li>Aktifkan Authentication → Sign-in method → Google.</li>
          <li>Buat Cloud Firestore database.</li>
          <li>
            Salin <code>.env.example</code> menjadi <code>.env.local</code> dan isi nilai konfigurasi.
          </li>
          <li>
            Deploy rules: <code>firebase deploy --only firestore:rules</code>
          </li>
          <li>Jalankan ulang <code>npm run dev</code>.</li>
        </ol>
      </div>
    </div>
  );
}
