import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetChatsQuery, useGetMessagesQuery, useSendMessageMutation, useStartChatMutation } from '../services/chatApi.js';
import { selectUser } from '../features/auth/authSlice.js';
import { notify } from '../features/ui/uiSlice.js';
import { formatDateTime, timeAgo } from '../utils/format.js';
import { Avatar, EmptyState, ErrorBox, Modal, Spinner } from '../components/ui.jsx';
import UserPicker from '../components/UserPicker.jsx';

function chatTitle(chat, uid) {
  if (chat.isGroup) return { name: chat.name, photo: null };
  const otherId = chat.members.find((m) => m !== uid) || uid;
  const other = chat.memberInfo?.[otherId] || {};
  return { name: other.displayName || 'Pengguna', photo: other.photoURL };
}

function NewChat({ onDone }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');
  const [start, { isLoading }] = useStartChatMutation();
  const toggle = (u) => setSelected((s) => (s.some((x) => x.uid === u.uid) ? s.filter((x) => x.uid !== u.uid) : [...s, u]));

  const submit = async () => {
    const res = await start({ users: selected, name });
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    onDone();
    navigate(`/chat/${res.data.id}`);
  };

  return (
    <div className="form">
      <UserPicker selected={selected} onToggle={toggle} />
      {selected.length > 1 && (
        <label>
          Nama grup
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Liburan Bali" />
        </label>
      )}
      <button className="btn btn-primary" disabled={!selected.length || isLoading} onClick={submit}>
        {selected.length > 1 ? 'Buat grup' : 'Mulai chat'}
      </button>
    </div>
  );
}

function ChatRoom({ chat, me }) {
  const { data: messages = [], isLoading, error } = useGetMessagesQuery(chat.id);
  const [send, { isLoading: sending }] = useSendMessageMutation();
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const { name, photo } = chatTitle(chat, me.uid);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const value = text;
    setText('');
    const res = await send({ chatId: chat.id, text: value, chat });
    if (res.error) setText(value);
  };

  return (
    <section className="chat-room">
      <header className="chat-room-head">
        <Link to="/chat" className="icon-btn mobile-only">
          ←
        </Link>
        <Avatar name={name} src={photo} size={34} />
        <div>
          <strong>{name}</strong>
          {chat.isGroup && <div className="muted small">{chat.members.length} anggota</div>}
        </div>
      </header>
      <div className="messages">
        <ErrorBox error={error} />
        {isLoading ? (
          <Spinner />
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg ${m.senderId === me.uid ? 'mine' : ''}`}>
              {chat.isGroup && m.senderId !== me.uid && <div className="msg-sender">{m.senderName}</div>}
              <div className="msg-text">{m.text}</div>
              <div className="msg-time">{formatDateTime(m.createdAt)}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..." maxLength={2000} />
        <button className="btn btn-primary" disabled={sending || !text.trim()}>
          Kirim
        </button>
      </form>
    </section>
  );
}

export default function ChatPage() {
  const { chatId } = useParams();
  const me = useSelector(selectUser);
  const [creating, setCreating] = useState(false);
  const { data: chats = [], isLoading, error } = useGetChatsQuery();
  const active = chats.find((c) => c.id === chatId);

  return (
    <div className={`chat-layout ${chatId ? 'has-active' : ''}`}>
      <aside className="chat-list">
        <div className="chat-list-head">
          <h2>Chat</h2>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Baru
          </button>
        </div>
        <ErrorBox error={error} />
        {isLoading ? (
          <Spinner />
        ) : !chats.length ? (
          <EmptyState icon="💬" title="Belum ada percakapan">
            Mulai chat dengan teman untuk membahas tagihan atau rencana keuangan.
          </EmptyState>
        ) : (
          <ul>
            {chats.map((c) => {
              const { name, photo } = chatTitle(c, me.uid);
              return (
                <li key={c.id}>
                  <Link to={`/chat/${c.id}`} className={`chat-item ${c.id === chatId ? 'active' : ''}`}>
                    <Avatar name={name} src={photo} size={40} />
                    <div className="chat-item-main">
                      <div className="chat-item-top">
                        <strong>{name}</strong>
                        <small className="muted">{timeAgo(c.updatedAt)}</small>
                      </div>
                      <div className="muted small ellipsis">
                        {c.lastMessage ? `${c.lastMessage.senderId === me.uid ? 'Kamu: ' : ''}${c.lastMessage.text}` : 'Belum ada pesan'}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      {active ? (
        <ChatRoom key={active.id} chat={active} me={me} />
      ) : (
        <section className="chat-room chat-placeholder">
          {chatId && isLoading ? <Spinner /> : <EmptyState icon="👈" title="Pilih percakapan" />}
        </section>
      )}
      {creating && (
        <Modal title="Chat baru" onClose={() => setCreating(false)}>
          <NewChat onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
