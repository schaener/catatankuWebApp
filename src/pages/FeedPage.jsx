import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useAddCommentMutation,
  useCreatePostMutation,
  useDeleteCommentMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useGetFeedQuery,
  useToggleLikeMutation,
} from '../services/postsApi.js';
import { selectUser } from '../features/auth/authSlice.js';
import { notify, postDraftSet } from '../features/ui/uiSlice.js';
import { formatIDR, timeAgo } from '../utils/format.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/constants.js';
import { confirmAction } from '../utils/env.js';
import { Avatar, EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';

const MOODS = ['🎉 Hemat', '😅 Boros', '💡 Tips', '🎯 Target', '🛍️ Belanja', '🙏 Syukur'];
const PAGE = 20;

function Composer() {
  const me = useSelector(selectUser);
  const draft = useSelector((s) => s.ui.postDraft);
  const dispatch = useDispatch();
  const [create, { isLoading }] = useCreatePostMutation();
  const empty = { text: '', amount: '', category: '', mood: '', imageUrl: '' };
  const [form, setForm] = useState(empty);
  const [expanded, setExpanded] = useState(false);

  // Prefill when a transaction was shared from another page
  useEffect(() => {
    if (draft) {
      setForm({ ...empty, ...draft });
      setExpanded(true);
      dispatch(postDraftSet(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dispatch]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) return;
    const res = await create(form);
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    setForm(empty);
    setExpanded(false);
  };

  return (
    <form className="card composer-card" onSubmit={submit}>
      <div className="inline top">
        <Avatar name={me.displayName} src={me.photoURL} />
        <textarea
          className="grow"
          rows={expanded ? 3 : 1}
          placeholder="Bagikan cerita, tips hemat, atau pencapaian keuanganmu..."
          value={form.text}
          maxLength={2000}
          onFocus={() => setExpanded(true)}
          onChange={set('text')}
        />
      </div>
      {expanded && (
        <>
          <div className="chips">
            {MOODS.map((m) => (
              <button type="button" key={m} className={`chip ${form.mood === m ? 'chip-active' : ''}`} onClick={() => setForm((f) => ({ ...f, mood: f.mood === m ? '' : m }))}>
                {m}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <input type="number" min="0" placeholder="Nominal (opsional)" value={form.amount} onChange={set('amount')} />
            <select value={form.category} onChange={set('category')}>
              <option value="">Kategori (opsional)</option>
              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="grow" type="url" placeholder="URL gambar (opsional)" value={form.imageUrl} onChange={set('imageUrl')} />
          </div>
          <div className="inline end">
            <button type="button" className="btn btn-ghost" onClick={() => (setForm(empty), setExpanded(false))}>
              Batal
            </button>
            <button className="btn btn-primary" disabled={isLoading || !form.text.trim()}>
              {isLoading ? 'Memposting...' : 'Posting'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function Comments({ post, me }) {
  const postId = post.id;
  const { data = [], isLoading } = useGetCommentsQuery(postId);
  const [add, { isLoading: sending }] = useAddCommentMutation();
  const [remove] = useDeleteCommentMutation();
  const [text, setText] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await add({ postId, text, post });
    if (!res.error) setText('');
  };
  return (
    <div className="comments">
      {isLoading ? (
        <Spinner />
      ) : (
        data.map((c) => (
          <div key={c.id} className="comment">
            <Avatar name={c.authorName} src={c.authorPhoto} size={26} />
            <div className="comment-body">
              <strong>{c.authorName}</strong> {c.text}
              <div className="muted small">
                {timeAgo(c.createdAt)}
                {c.authorId === me.uid && (
                  <button className="link-btn" onClick={() => remove({ postId, commentId: c.id })}>
                    hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      <form className="inline" onSubmit={submit}>
        <input className="grow" placeholder="Tulis komentar..." value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-ghost" disabled={sending || !text.trim()}>
          Kirim
        </button>
      </form>
    </div>
  );
}

function Post({ post, me }) {
  const [showComments, setShowComments] = useState(false);
  const [toggleLike] = useToggleLikeMutation();
  const [remove] = useDeletePostMutation();
  const liked = post.likes?.includes(me.uid);
  return (
    <article className="card post">
      <header className="post-head">
        <Avatar name={post.authorName} src={post.authorPhoto} />
        <div className="grow">
          <strong>{post.authorName}</strong>
          <div className="muted small">
            {timeAgo(post.createdAt)}
            {post.mood && ` · ${post.mood}`}
          </div>
        </div>
        {post.authorId === me.uid && (
          <button className="icon-btn" title="Hapus" onClick={() => confirmAction('Hapus postingan?') && remove(post.id)}>
            🗑️
          </button>
        )}
      </header>
      <p className="pre">{post.text}</p>
      {(post.amount || post.category) && (
        <div className="post-tags">
          {post.amount ? <span className="tag">{formatIDR(post.amount)}</span> : null}
          {post.category && <span className="tag">#{post.category.replace(/\s|&/g, '')}</span>}
        </div>
      )}
      {post.imageUrl && <img className="post-img" src={post.imageUrl} alt="" loading="lazy" />}
      <footer className="post-actions">
        <button className={`link-btn ${liked ? 'liked' : ''}`} onClick={() => toggleLike({ postId: post.id, liked, post })}>
          {liked ? '❤️' : '🤍'} {post.likeCount || 0}
        </button>
        <button className="link-btn" onClick={() => setShowComments((s) => !s)}>
          💬 {post.commentCount || 0}
        </button>
      </footer>
      {showComments && <Comments post={post} me={me} />}
    </article>
  );
}

export default function FeedPage() {
  const me = useSelector(selectUser);
  const [max, setMax] = useState(PAGE);
  const { data = [], isLoading, isFetching, error } = useGetFeedQuery(max);
  return (
    <div className="page feed">
      <PageHeader title="Feed" subtitle="Berbagi cerita keuangan dengan komunitas" />
      <Composer />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data.length ? (
        <EmptyState icon="🌐" title="Belum ada postingan">Jadilah yang pertama berbagi!</EmptyState>
      ) : (
        <>
          {data.map((p) => (
            <Post key={p.id} post={p} me={me} />
          ))}
          {data.length >= max && (
            <button className="btn btn-ghost block" disabled={isFetching} onClick={() => setMax((m) => m + PAGE)}>
              {isFetching ? 'Memuat...' : 'Muat lebih banyak'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
