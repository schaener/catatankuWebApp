// Sample data for the demo build. Everything here is fictional.
import { summarize } from '../utils/finance.js';
import { monthKeysBetween, monthRange, toDateStr } from '../utils/date.js';

export const DEMO_USER = {
  uid: 'demo-user',
  displayName: 'Dimas Demo',
  email: 'dimas@demo.catatan',
  photoURL: null,
};

const FRIENDS = [
  { uid: 'u-rina', displayName: 'Rina Wijaya', email: 'rina@demo.catatan' },
  { uid: 'u-andi', displayName: 'Andi Pratama', email: 'andi@demo.catatan' },
  { uid: 'u-sari', displayName: 'Sari Lestari', email: 'sari@demo.catatan' },
];

// Deterministic pseudo-random so every fresh demo looks the same
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const EXPENSES = [
  ['Makanan & Minuman', 'Warteg Bahari', [18000, 35000], 'Tunai', 'Makan siang'],
  ['Makanan & Minuman', 'Kopi Kenangan', [22000, 45000], 'E-Wallet', 'Kopi pagi'],
  ['Makanan & Minuman', 'GrabFood', [40000, 110000], 'E-Wallet', 'Makan malam'],
  ['Transportasi', 'Pertamina', [100000, 250000], 'Debit', 'Bensin motor'],
  ['Transportasi', 'Gojek', [15000, 60000], 'E-Wallet', 'Ojek ke kantor'],
  ['Transportasi', 'KRL Commuter', [5000, 15000], 'E-Wallet', ''],
  ['Belanja', 'Indomaret', [30000, 150000], 'Debit', 'Belanja harian'],
  ['Belanja', 'Tokopedia', [80000, 450000], 'Transfer', 'Belanja online'],
  ['Hiburan', 'CGV Grand Indonesia', [50000, 120000], 'Kartu Kredit', 'Nonton'],
  ['Kesehatan', 'Apotek K-24', [25000, 120000], 'Tunai', 'Obat flu'],
];

const MONTHLY = [
  ['Tagihan', 'PLN', 350000, 'Transfer', 'Token listrik', 5],
  ['Tagihan', 'Indihome', 385000, 'Transfer', 'Internet rumah', 8],
  ['Rumah', 'Kos Tebet', 2200000, 'Transfer', 'Sewa kos', 1],
  ['Hiburan', 'Netflix', 65000, 'Kartu Kredit', 'Langganan', 12],
];

const round = (n) => Math.round(n / 500) * 500;

function buildTransactions(now) {
  const rand = rng(42);
  const list = [];
  let id = 0;
  const push = (tx) => list.push({ id: `tx${++id}`, createdAt: tx.date, ...tx });
  for (let m = 5; m >= 0; m--) {
    const year = now.getFullYear();
    const month = now.getMonth() - m;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDay = m === 0 ? now.getDate() : daysInMonth;
    const at = (day, hour = 12) => new Date(year, month, Math.min(day, lastDay), hour, Math.floor(rand() * 59)).getTime();

    push({ type: 'income', amount: 8500000, category: 'Gaji', place: 'PT Nusantara Digital', paymentMethod: 'Transfer', note: 'Gaji bulanan', date: at(1, 9) });
    if (m % 2 === 0) {
      push({ type: 'income', amount: round(750000 + rand() * 1500000), category: 'Penjualan', place: 'Freelance desain', paymentMethod: 'Transfer', note: 'Proyek logo', date: at(14, 16) });
    }
    for (const [category, place, amount, method, note, day] of MONTHLY) {
      if (day <= lastDay) push({ type: 'expense', amount, category, place, paymentMethod: method, note, date: at(day, 10) });
    }
    const count = Math.round((14 + rand() * 6) * (lastDay / daysInMonth));
    for (let i = 0; i < count; i++) {
      const [category, place, [lo, hi], method, note] = EXPENSES[Math.floor(rand() * EXPENSES.length)];
      push({
        type: 'expense',
        amount: round(lo + rand() * (hi - lo)),
        category,
        place,
        paymentMethod: method,
        note,
        date: at(1 + Math.floor(rand() * lastDay), 8 + Math.floor(rand() * 13)),
      });
    }
  }
  return list;
}

export function seedDatabase(store) {
  const now = new Date();
  const ago = (min) => Date.now() - min * 60000;
  const me = DEMO_USER;
  const all = [me, ...FRIENDS];
  const info = (u) => ({ displayName: u.displayName, photoURL: null });
  const [rina, andi, sari] = FRIENDS;

  for (const u of all) {
    store.set(`users/${u.uid}`, {
      displayName: u.displayName,
      displayNameLower: u.displayName.toLowerCase(),
      email: u.email,
      photoURL: null,
      lastLoginAt: ago(60),
    });
  }

  const txs = buildTransactions(now);
  for (const { id, ...t } of txs) store.set(`users/${me.uid}/transactions/${id}`, t);

  // One ready-made report for last month
  const lm = monthRange(now, -1);
  const lmTx = txs
    .filter((t) => toDateStr(t.date) >= lm.from && toDateStr(t.date) <= lm.to)
    .sort((a, b) => b.date - a.date);
  const monthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  store.set(`users/${me.uid}/reports/r1`, {
    title: `Laporan ${monthName}`,
    from: lm.from,
    to: lm.to,
    notes: 'Pengeluaran makan di luar masih tinggi. Target bulan depan: masak di rumah 3x seminggu.',
    summary: summarize(lmTx, monthKeysBetween(lm.from, lm.to)),
    transactions: lmTx.map(({ createdAt, ...t }) => t),
    createdAt: ago(60 * 24 * 3),
  });

  // Split bills
  store.set('splitBills/sb1', {
    title: 'Makan malam tim',
    place: 'Sate Khas Senayan',
    date: ago(60 * 24 * 2),
    mode: 'equal',
    taxPercent: 10,
    servicePercent: 5,
    subtotal: 640000,
    total: 736000,
    items: [],
    participants: [
      { id: me.uid, uid: me.uid, name: me.displayName, amount: 184000, paid: true },
      { id: rina.uid, uid: rina.uid, name: rina.displayName, amount: 184000, paid: true, paidAt: ago(60 * 20) },
      { id: andi.uid, uid: andi.uid, name: andi.displayName, amount: 184000, paid: false },
      { id: 'g-budi', uid: null, name: 'Budi (tamu)', amount: 184000, paid: false },
    ],
    ownerId: me.uid,
    ownerName: me.displayName,
    memberUids: [me.uid, rina.uid, andi.uid],
    createdAt: ago(60 * 24 * 2),
  });
  store.set('splitBills/sb2', {
    title: 'Villa Puncak',
    place: 'Villa Cisarua',
    date: ago(60 * 24 * 9),
    mode: 'items',
    taxPercent: 0,
    servicePercent: 0,
    subtotal: 2400000,
    total: 2400000,
    items: [
      { id: 'i1', name: 'Sewa villa 1 malam', price: 1800000, qty: 1, assignedTo: [me.uid, rina.uid, sari.uid] },
      { id: 'i2', name: 'BBQ & minuman', price: 600000, qty: 1, assignedTo: [me.uid, rina.uid, sari.uid] },
    ],
    participants: [
      { id: me.uid, uid: me.uid, name: me.displayName, amount: 800000, paid: false },
      { id: rina.uid, uid: rina.uid, name: rina.displayName, amount: 800000, paid: true },
      { id: sari.uid, uid: sari.uid, name: sari.displayName, amount: 800000, paid: true },
    ],
    ownerId: rina.uid,
    ownerName: rina.displayName,
    memberUids: [rina.uid, me.uid, sari.uid],
    createdAt: ago(60 * 24 * 9),
  });

  // Chats
  const dm = [me.uid, rina.uid].sort().join('_');
  store.set(`chats/${dm}`, {
    members: [me.uid, rina.uid],
    memberInfo: { [me.uid]: info(me), [rina.uid]: info(rina) },
    isGroup: false,
    name: null,
    lastMessage: { text: 'Udah aku transfer ya buat yang sate kemarin 🙏', senderId: rina.uid, senderName: rina.displayName },
    createdAt: ago(60 * 30),
    updatedAt: ago(60 * 20),
  });
  [
    [rina, 'Dim, total sate kemarin jadi berapa per orang?', 60 * 21],
    [me, 'Rp 184.000 udah termasuk pajak & service. Detailnya ada di split bill ya', 60 * 20.8],
    [rina, 'Udah aku transfer ya buat yang sate kemarin 🙏', 60 * 20],
  ].forEach(([u, text, min], i) =>
    store.set(`chats/${dm}/messages/m${i}`, { text, senderId: u.uid, senderName: u.displayName, createdAt: ago(min) }),
  );
  store.set('chats/g-puncak', {
    members: [me.uid, rina.uid, sari.uid],
    memberInfo: { [me.uid]: info(me), [rina.uid]: info(rina), [sari.uid]: info(sari) },
    isGroup: true,
    name: '🏡 Villa Puncak',
    lastMessage: { text: 'Siap, nanti malam aku bayar bagianku', senderId: me.uid, senderName: me.displayName },
    createdAt: ago(60 * 24 * 9),
    updatedAt: ago(60 * 24 * 8),
  });
  [
    [rina, 'Guys, split bill villa udah aku buat ya. Masing-masing 800rb', 60 * 24 * 8.2],
    [sari, 'Done transfer ✅', 60 * 24 * 8.1],
    [me, 'Siap, nanti malam aku bayar bagianku', 60 * 24 * 8],
  ].forEach(([u, text, min], i) =>
    store.set(`chats/g-puncak/messages/m${i}`, { text, senderId: u.uid, senderName: u.displayName, createdAt: ago(min) }),
  );

  // Feed
  const posts = [
    { id: 'p1', author: sari, text: 'Akhirnya dana darurat tembus 6x pengeluaran bulanan! Konsisten nabung 20% tiap gajian ternyata bisa 💪', mood: '🎯 Target', amount: 30000000, category: 'Investasi', min: 45, likes: [rina.uid, andi.uid], comments: [[rina, 'Keren banget Sar! Inspiratif 🔥', 30]] },
    { id: 'p2', author: andi, text: 'Tips: matikan auto-renew langganan yang jarang dipakai. Aku baru sadar bayar 3 streaming sekaligus 🙈', mood: '💡 Tips', amount: 186000, category: 'Hiburan', min: 60 * 5, likes: [sari.uid], comments: [] },
    { id: 'p4', author: me, text: 'Challenge no-jajan seminggu: hari ke-5 dan udah hemat Rp 250.000! Siapa mau ikutan? 🙌', mood: '🎉 Hemat', amount: 250000, category: 'Makanan & Minuman', min: 90, likes: [rina.uid, sari.uid], comments: [[sari, 'Ikut dong! Mulai Senin ya 😆', 35]] },
    { id: 'p3', author: rina, text: 'Bulan ini kopi kekinian habis 600rb sendiri. Bulan depan coba bawa tumbler & seduh sendiri ☕', mood: '😅 Boros', amount: 600000, category: 'Makanan & Minuman', min: 60 * 26, likes: [me.uid, sari.uid, andi.uid], comments: [[andi, 'Sama banget 😂', 60 * 25], [me, 'Ayo challenge bareng!', 60 * 24]] },
  ];
  for (const p of posts) {
    store.set(`posts/${p.id}`, {
      text: p.text,
      amount: p.amount,
      category: p.category,
      mood: p.mood,
      imageUrl: null,
      authorId: p.author.uid,
      authorName: p.author.displayName,
      authorPhoto: null,
      likes: p.likes,
      likeCount: p.likes.length,
      commentCount: p.comments.length,
      createdAt: ago(p.min),
    });
    p.comments.forEach(([u, text, min], i) =>
      store.set(`posts/${p.id}/comments/c${i}`, { text, authorId: u.uid, authorName: u.displayName, authorPhoto: null, createdAt: ago(min) }),
    );
  }

  // Notifications for the demo user
  const notif = (id, u, data, min, read = false) =>
    store.set(`users/${me.uid}/notifications/${id}`, { actorId: u.uid, actorName: u.displayName, actorPhoto: null, read, updatedAt: ago(min), ...data });
  const p4 = posts.find((p) => p.id === 'p4');
  notif(`like_p4_${rina.uid}`, rina, { type: 'like', postId: 'p4', text: p4.text.slice(0, 80) }, 80, true);
  notif(`like_p4_${sari.uid}`, sari, { type: 'like', postId: 'p4', text: p4.text.slice(0, 80) }, 40);
  notif('comment_c0', sari, { type: 'comment', postId: 'p4', text: p4.comments[0][1] }, 35);
  notif(`chat_${dm}`, rina, { type: 'message', chatId: dm, chatName: null, text: 'Udah aku transfer ya buat yang sate kemarin 🙏', count: 1 }, 60 * 20);
}

const REPLIES = ['Oke siap 👍', 'Wah mantap, nanti aku cek ya', 'Hahaha bener juga', 'Noted! Makasih infonya', 'Boleh, kabarin aja 🙌'];

const COMMENTS = ['Keren! 🔥', 'Setuju banget 👍', 'Wah inspiratif, mau coba juga', 'Semangat terus! 💪'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function notifyDemoUser(db, id, friend, data) {
  db.store.set(`users/${DEMO_USER.uid}/notifications/${id}`, {
    actorId: friend.uid,
    actorName: friend.displayName,
    actorPhoto: null,
    read: false,
    updatedAt: Date.now(),
    ...data,
  });
}

/**
 * Friends react so chat & notifications feel alive in the demo:
 * they answer your chat messages, and like + comment on your new posts.
 */
const reactedPosts = new Set();
export function scheduleAutoReply(path, data, db) {
  const post = path.match(/^posts\/([^/]+)$/);
  if (post && data.authorId === DEMO_USER.uid && !reactedPosts.has(post[1]) && !data.likes?.length && !data.commentCount) {
    const postId = post[1];
    reactedPosts.add(postId);
    const [liker, commenter] = [...FRIENDS].sort(() => Math.random() - 0.5);
    setTimeout(() => {
      const p = db.store.get(path);
      if (!p) return;
      db.store.set(path, { ...p, likes: [...p.likes, liker.uid], likeCount: p.likeCount + 1 });
      notifyDemoUser(db, `like_${postId}_${liker.uid}`, liker, { type: 'like', postId, text: p.text.slice(0, 80) });
      db.changed();
    }, 3000);
    setTimeout(() => {
      const p = db.store.get(path);
      if (!p) return;
      const id = db.newId();
      const text = pick(COMMENTS);
      db.store.set(`${path}/comments/${id}`, { text, authorId: commenter.uid, authorName: commenter.displayName, authorPhoto: null, createdAt: Date.now() });
      db.store.set(path, { ...p, commentCount: p.commentCount + 1 });
      notifyDemoUser(db, `comment_${id}`, commenter, { type: 'comment', postId, text });
      db.changed();
    }, 6000);
    return;
  }

  const m = path.match(/^chats\/([^/]+)\/messages\/[^/]+$/);
  if (!m || data.senderId !== DEMO_USER.uid) return;
  const chatPath = `chats/${m[1]}`;
  setTimeout(() => {
    const chat = db.store.get(chatPath);
    if (!chat) return;
    const others = chat.members.filter((u) => u !== DEMO_USER.uid);
    const uid = pick(others);
    const name = chat.memberInfo?.[uid]?.displayName || 'Teman';
    const text = pick(REPLIES);
    db.store.set(`${chatPath}/messages/${db.newId()}`, { text, senderId: uid, senderName: name, createdAt: Date.now() });
    db.store.set(chatPath, { ...chat, lastMessage: { text, senderId: uid, senderName: name }, updatedAt: Date.now() });
    const prev = db.store.get(`users/${DEMO_USER.uid}/notifications/chat_${m[1]}`);
    notifyDemoUser(db, `chat_${m[1]}`, { uid, displayName: name }, {
      type: 'message',
      chatId: m[1],
      chatName: chat.isGroup ? chat.name : null,
      text,
      count: (prev && !prev.read ? prev.count || 0 : 0) + 1,
    });
    db.changed();
  }, 1500);
}
