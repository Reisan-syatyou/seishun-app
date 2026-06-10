'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Screen = 'top' | 'login' | 'register' | 'setup' | 'home' | 'camera' | 'friendsposts' | 'friends' | 'search' | 'profile' | 'friendarchive';

// ── デザイントークン ──────────────────────────────────────
const C: Record<string, string> = {
  accent:    '#0288d1',
  accentDark:'#0277bd',
  accentSoft:'rgba(2,136,209,0.12)',
  text:      '#01579b',
  sub:       '#4fc3f7',
  subLight:  '#b3e0f7',
  bg:        'linear-gradient(160deg, #e0f7fa 0%, #b2ebf2 40%, #e0f2f1 100%)',
  card:      'rgba(255,255,255,0.92)',
  white:     '#ffffff',
  danger:    '#e53935',
  gold:      'linear-gradient(135deg, #ffd54f, #ff8f00)',
};

const radius = { sm: '10px', md: '14px', lg: '18px', xl: '24px', full: '9999px' };

const s = {
  input: {
    width: '100%', padding: '13px 16px', fontSize: '15px',
    borderRadius: radius.md, border: `1.5px solid ${C.subLight}`,
    background: 'rgba(255,255,255,0.85)', color: C.text, outline: 'none',
  } as React.CSSProperties,

  btn: (bg = C.accent, color = C.white): React.CSSProperties => ({
    width: '100%', padding: '15px', fontSize: '16px', fontWeight: '700',
    borderRadius: radius.lg, border: 'none', background: bg,
    color, cursor: 'pointer',
  }),

  card: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: C.card, borderRadius: radius.lg,
    border: `0.5px solid rgba(2,136,209,0.15)`,
    ...extra,
  }),

  header: {
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(14px)',
    borderBottom: `0.5px solid rgba(2,136,209,0.12)`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('top');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [school, setSchool] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayPost, setTodayPost] = useState<{ image_url: string } | null>(null);
  const [userId, setUserId] = useState('');
  const [friends, setFriends] = useState<{ id: string; display_name: string; username: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; username: string }[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; requester: { id: string; display_name: string; username: string } }[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<{ id: string; image_url: string; user_id: string; display_name: string }[]>([]);
  const [allPosts, setAllPosts] = useState<{ image_url: string; posted_at: string }[]>([]);
  const [isGraduated, setIsGraduated] = useState(false);
  const [postedDates, setPostedDates] = useState<string[]>([]);
  const [likes, setLikes] = useState<{ post_id: string; count: number; liked: boolean }[]>([]);
  const [streak, setStreak] = useState(0);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; display_name: string; content: string }[]>>({});
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [archiveMonth, setArchiveMonth] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<{ id: string; display_name: string; username: string; school?: string } | null>(null);
  const [friendArchivePosts, setFriendArchivePosts] = useState<{ image_url: string; posted_at: string }[]>([]);
  const [friendArchiveMonth, setFriendArchiveMonth] = useState<string | null>(null);
  const [friendGraduated, setFriendGraduated] = useState(false);

  // ── データ取得 ────────────────────────────────────────────
  const fetchTodayPost = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('posts').select('*').eq('user_id', uid).eq('posted_at', today);
    if (data && data.length > 0) setTodayPost(data[0]);
  };

  const fetchFriends = async (uid: string) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:requester_id(id, display_name, username), receiver:receiver_id(id, display_name, username)')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    if (data) {
      const friendList = data.map(f => f.requester_id === uid ? f.receiver : f.requester);
      setFriends(friendList);
    }
  };

  const fetchPendingRequests = async (uid: string) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:requester_id(id, display_name, username)')
      .eq('receiver_id', uid)
      .eq('status', 'pending');
    if (data) setPendingRequests(data);
  };

  const fetchLikes = async (uid: string, posts: { id: string }[]) => {
    if (posts.length === 0) return;
    const postIds = posts.map(p => p.id);
    const { data } = await supabase.from('likes').select('*').in('post_id', postIds);
    if (data) {
      setLikes(postIds.map(pid => ({
        post_id: pid,
        count: data.filter(l => l.post_id === pid).length,
        liked: data.some(l => l.post_id === pid && l.user_id === uid),
      })));
    }
  };

  const toggleLike = async (postId: string) => {
    const existing = likes.find(l => l.post_id === postId);
    if (existing?.liked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    }
    setLikes(prev => prev.map(l => l.post_id === postId
      ? { ...l, count: existing?.liked ? l.count - 1 : l.count + 1, liked: !l.liked }
      : l));
  };

  const fetchFriendsPosts = async (uid: string) => {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    if (!friendships || friendships.length === 0) return;
    const friendIds = friendships.map(f => f.requester_id === uid ? f.receiver_id : f.requester_id);
    const today = new Date().toISOString().split('T')[0];
    const { data: posts } = await supabase
      .from('posts')
      .select('*, user:user_id(display_name)')
      .in('user_id', friendIds)
      .eq('posted_at', today);
    if (posts) {
      const mapped = posts.map(p => ({ ...p, display_name: p.user?.display_name || '' }));
      setFriendsPosts(mapped);
      await fetchLikes(uid, mapped);
      await fetchComments(mapped.map(p => p.id));
    }
  };

  const checkGraduation = async (uid: string) => {
    const { data: user } = await supabase.from('users').select('graduation_date').eq('id', uid).single();
    if (!user?.graduation_date) return;
    setGraduationDate(user.graduation_date);
    if (new Date() >= new Date(user.graduation_date)) {
      setIsGraduated(true);
      const { data: posts } = await supabase.from('posts').select('*').eq('user_id', uid).order('posted_at', { ascending: true });
      if (posts) setAllPosts(posts);
    }
  };

  const fetchPostedDates = async (uid: string) => {
    const { data } = await supabase.from('posts').select('posted_at').eq('user_id', uid).order('posted_at', { ascending: false });
    if (data) {
      const dates = data.map(p => p.posted_at);
      setPostedDates(dates);
      let count = 0;
      const today = new Date();
      for (let i = 0; i < dates.length; i++) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);
        if (dates[i] === expected.toISOString().split('T')[0]) { count++; } else { break; }
      }
      setStreak(count);
    }
  };

  const fetchComments = async (postIds: string[]) => {
    if (postIds.length === 0) return;
    const { data } = await supabase
      .from('comments')
      .select('*, user:user_id(display_name)')
      .in('post_id', postIds);
    if (data) {
      const grouped: Record<string, { id: string; user_id: string; display_name: string; content: string }[]> = {};
      for (const c of data) {
        if (!grouped[c.post_id]) grouped[c.post_id] = [];
        grouped[c.post_id].push({ id: c.id, user_id: c.user_id, display_name: c.user?.display_name || '', content: c.content });
      }
      setComments(prev => ({ ...prev, ...grouped }));
    }
  };

  const addComment = async (postId: string) => {
    const content = commentInput[postId]?.trim();
    if (!content) return;
    const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content });
    if (error) { alert('コメント送信エラー: ' + error.message); return; }
    setCommentInput(prev => ({ ...prev, [postId]: '' }));
    await fetchComments([postId]);
  };

  const acceptFriendRequest = async (friendshipId: string, uid: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await fetchFriends(uid);
    await fetchPendingRequests(uid);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase
      .from('users').select('id, display_name, username')
      .ilike('username', `%${searchQuery}%`).neq('id', userId);
    if (!data) return;
    setSearchResults(data);
    if (data.length > 0) {
      const { data: pending } = await supabase
        .from('friendships')
        .select('receiver_id')
        .eq('requester_id', userId)
        .eq('status', 'pending')
        .in('receiver_id', data.map(u => u.id));
      if (pending) setSentRequests(new Set(pending.map(p => p.receiver_id)));
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    await supabase.from('friendships').insert({ requester_id: userId, receiver_id: receiverId, status: 'pending' });
    setSentRequests(prev => new Set(prev).add(receiverId));
  };

  const openFriendArchive = async (friend: { id: string; display_name: string; username: string }) => {
    const { data: user } = await supabase.from('users').select('graduation_date, school').eq('id', friend.id).single();
    const graduated = user?.graduation_date ? new Date() >= new Date(user.graduation_date) : false;
    setSelectedFriend({ ...friend, school: user?.school ?? '' });
    setFriendGraduated(graduated);
    setFriendArchivePosts([]);
    setFriendArchiveMonth(null);
    if (graduated) {
      const { data: posts } = await supabase.from('posts').select('image_url, posted_at').eq('user_id', friend.id).order('posted_at', { ascending: true });
      if (posts) setFriendArchivePosts(posts);
    }
    setScreen('friendarchive');
  };

  const compressImage = (file: File, maxPx = 1080, quality = 0.82): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圧縮失敗')), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = url;
    });

  const saveProfile = async () => {
    await supabase.from('users').update({ display_name: editDisplayName, school: editSchool }).eq('id', userId);
    setDisplayName(editDisplayName);
    setSchool(editSchool);
    setIsEditingProfile(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: user } = await supabase.from('users').select('*').eq('id', data.session.user.id).single();
        if (user?.username) {
          setUsername(user.username);
          setDisplayName(user.display_name ?? '');
          setSchool(user.school ?? '');
          setUserId(data.session.user.id);
          await Promise.all([
            fetchTodayPost(data.session.user.id),
            fetchFriendsPosts(data.session.user.id),
            checkGraduation(data.session.user.id),
            fetchPostedDates(data.session.user.id),
            fetchFriends(data.session.user.id),
            fetchPendingRequests(data.session.user.id),
          ]);
          setScreen('home');
        } else { setScreen('setup'); }
      }
    });
  }, []);

  useEffect(() => {
    if (screen === 'camera' && todayPost) setScreen('home');
  }, [screen, todayPost]);

  // ── 認証 ─────────────────────────────────────────────────
  const register = async () => {
    setLoading(true); setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    alert('メールに確認リンクを送りました。確認後にログインしてください。');
    setScreen('login'); setLoading(false);
  };

  const login = async () => {
    setLoading(true); setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message.includes('Email not confirmed') ? 'メールの確認が完了していません。' : error.message);
      setLoading(false); return;
    }
    const { data: user } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    if (user?.username) {
      setUsername(user.username); setDisplayName(user.display_name ?? ''); setSchool(user.school ?? ''); setUserId(data.user.id);
      await Promise.all([
        fetchTodayPost(data.user.id),
        fetchFriendsPosts(data.user.id),
        checkGraduation(data.user.id),
        fetchPostedDates(data.user.id),
        fetchFriends(data.user.id),
        fetchPendingRequests(data.user.id),
      ]);
      setScreen('home');
    } else { setUserId(data.user.id); setScreen('setup'); }
    setLoading(false);
  };

  const setup = async () => {
    if (!username || !displayName || !graduationDate) { setError('すべて入力してください'); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.from('users').upsert({ id: data.session.user.id, username, display_name: displayName, school, graduation_date: graduationDate });
    setUserId(data.session.user.id);
    setScreen('home');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setScreen('top');
    setUsername(''); setTodayPost(null); setFriendsPosts([]);
    setIsGraduated(false); setAllPosts([]); setLikes([]);
    setFriends([]); setPendingRequests([]);
  };

  // ── 共通パーツ ────────────────────────────────────────────
  const BottomNav = () => (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)',
      borderTop: `0.5px solid rgba(2,136,209,0.12)`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 22px', zIndex: 100,
    }}>
      <button
        onClick={() => setScreen('home')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: screen === 'home' ? C.accent : C.subLight }}
      >
        <span style={{ fontSize: '22px' }}>📸</span>
        <span style={{ fontSize: '10px', fontWeight: screen === 'home' ? '700' : '400' }}>マイ投稿</span>
      </button>

      <button
        onClick={() => { fetchFriendsPosts(userId); setScreen('friendsposts'); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: screen === 'friendsposts' ? C.accent : C.subLight }}
      >
        <span style={{ fontSize: '22px' }}>🌅</span>
        <span style={{ fontSize: '10px', fontWeight: screen === 'friendsposts' ? '700' : '400' }}>友達の投稿</span>
      </button>

      {/* カメラボタン（中央） */}
      <div style={{ position: 'relative', marginTop: '-22px' }}>
        <button
          onClick={() => setScreen('camera')}
          style={{
            width: '60px', height: '60px', borderRadius: radius.full,
            background: C.accent, border: `3px solid white`,
            fontSize: '26px', cursor: 'pointer',
            boxShadow: `0 4px 20px rgba(2,136,209,0.45)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >📷</button>
      </div>

      <button
        onClick={() => setScreen('friends')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: screen === 'friends' || screen === 'search' ? C.accent : C.subLight }}
      >
        <span style={{ fontSize: '22px', position: 'relative', display: 'inline-block' }}>
          👥
          {pendingRequests.length > 0 && (
            <span style={{ position: 'absolute', top: '-4px', right: '-6px', background: C.danger, color: 'white', borderRadius: radius.full, fontSize: '10px', fontWeight: '700', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              {pendingRequests.length}
            </span>
          )}
        </span>
        <span style={{ fontSize: '10px', fontWeight: screen === 'friends' || screen === 'search' ? '700' : '400' }}>友達リスト</span>
      </button>

      <button
        onClick={() => setScreen('profile')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: screen === 'profile' ? C.accent : C.subLight }}
      >
        <span style={{ fontSize: '22px' }}>👤</span>
        <span style={{ fontSize: '10px', fontWeight: screen === 'profile' ? '700' : '400' }}>プロフィール</span>
      </button>
    </div>
  );

  // アバターアイコン
  const Avatar = ({ name }: { name: string }) => (
    <div style={{
      width: '40px', height: '40px', borderRadius: radius.full,
      background: `linear-gradient(135deg, ${C.sub}, ${C.accent})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: '15px', flexShrink: 0,
    }}>
      {name.charAt(0)}
    </div>
  );

  // ── トップ画面 ────────────────────────────────────────────
  if (screen === 'top') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '96px', height: '96px', background: C.white, borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '24px', boxShadow: `0 6px 28px rgba(2,136,209,0.2)` }}>📸</div>
      <h1 style={{ fontSize: '36px', fontWeight: '800', color: C.accentDark, marginBottom: '10px', letterSpacing: '-0.5px' }}>青春snap</h1>
      <p style={{ color: C.text, fontSize: '15px', marginBottom: '6px', textAlign: 'center', fontWeight: '500' }}>毎日1枚。卒業の日に、全部開く。</p>
      <p style={{ color: C.sub, fontSize: '13px', marginBottom: '56px', textAlign: 'center' }}>今日の写真は今日だけ見られる</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <button onClick={() => setScreen('register')} style={s.btn()}>はじめる</button>
        <button onClick={() => setScreen('login')} style={s.btn(C.white, C.accent)}>ログイン</button>
      </div>
    </main>
  );

  // ── ログイン・登録画面 ────────────────────────────────────
  if (screen === 'login' || screen === 'register') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: C.white, borderRadius: radius.xl, padding: '36px 28px', boxShadow: '0 8px 40px rgba(2,136,209,0.12)' }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '20px' }}>📸</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '28px', textAlign: 'center', color: C.accent }}>
          {screen === 'login' ? 'ログイン' : 'アカウント作成'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス" type="email" style={s.input} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="パスワード（6文字以上）" type="password" style={s.input} />
          {error && <p style={{ color: C.danger, fontSize: '13px' }}>{error}</p>}
          <button onClick={screen === 'login' ? login : register} disabled={loading} style={s.btn()}>
            {loading ? '...' : screen === 'login' ? 'ログイン' : '登録する'}
          </button>
          <button onClick={() => { setScreen('top'); setError(''); }} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '14px', padding: '8px' }}>← 戻る</button>
        </div>
      </div>
    </main>
  );

  // ── プロフィール設定画面 ──────────────────────────────────
  if (screen === 'setup') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: C.white, borderRadius: radius.xl, padding: '36px 28px', boxShadow: '0 8px 40px rgba(2,136,209,0.12)' }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '20px' }}>✏️</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', textAlign: 'center', color: C.accent }}>プロフィール設定</h2>
        <p style={{ color: C.sub, fontSize: '13px', marginBottom: '28px', textAlign: 'center' }}>卒業日を設定してください</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ユーザーID（例：taro_2025）" style={s.input} />
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="表示名（例：たろう）" style={s.input} />
          <input value={school} onChange={e => setSchool(e.target.value)} placeholder="学校名（任意）" style={s.input} />
          <div>
            <p style={{ fontSize: '13px', color: C.sub, marginBottom: '6px' }}>卒業予定日</p>
            <input value={graduationDate} onChange={e => setGraduationDate(e.target.value)} type="date" style={s.input} />
          </div>
          {error && <p style={{ color: C.danger, fontSize: '13px' }}>{error}</p>}
          <button onClick={setup} style={s.btn()}>青春をはじめる 🌸</button>
        </div>
      </div>
    </main>
  );

  // ── 友達アーカイブ画面 ────────────────────────────────────
  if (screen === 'friendarchive' && selectedFriend) {
    const byMonth: Record<string, { image_url: string; posted_at: string }[]> = {};
    for (const p of friendArchivePosts) {
      const ym = p.posted_at.slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(p);
    }
    const months = Object.keys(byMonth).sort();
    const selected = friendArchiveMonth ?? months[months.length - 1] ?? null;

    return (
      <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif', paddingBottom: '80px' }}>
        <div style={s.header}>
          <button onClick={() => setScreen('friends')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}>‹</button>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: C.accent, flex: 1, textAlign: 'center' }}>{selectedFriend.display_name}</h2>
          <div style={{ width: '32px' }} />
        </div>

        <div style={{ padding: '20px 18px' }}>
          {/* プロフィール */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: radius.full, background: `linear-gradient(135deg, ${C.sub}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '22px', flexShrink: 0 }}>
              {selectedFriend.display_name[0]}
            </div>
            <div>
              <p style={{ fontWeight: '700', fontSize: '17px', color: C.text }}>{selectedFriend.display_name}</p>
              <p style={{ color: C.sub, fontSize: '13px' }}>@{selectedFriend.username}</p>
              {selectedFriend.school && <p style={{ color: C.text, fontSize: '12px', opacity: 0.65, marginTop: '2px' }}>🏫 {selectedFriend.school}</p>}
            </div>
          </div>

          {!friendGraduated ? (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</p>
              <p style={{ color: C.text, fontWeight: '600', fontSize: '15px' }}>まだ卒業していません</p>
              <p style={{ color: C.sub, fontSize: '13px', marginTop: '8px' }}>卒業後に写真が解放されます</p>
            </div>
          ) : friendArchivePosts.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>📭</p>
              <p style={{ color: C.sub, fontSize: '14px' }}>投稿がありません</p>
            </div>
          ) : (
            <>
              <div style={{ background: C.gold, borderRadius: radius.lg, padding: '14px 18px', textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontWeight: '700', color: 'white', fontSize: '15px' }}>🎓 卒業！青春の記録 {friendArchivePosts.length}枚</p>
              </div>

              {/* 月セレクター */}
              <div style={{ overflowX: 'auto', display: 'flex', gap: '8px', paddingBottom: '4px', marginBottom: '16px' }}>
                {months.map(ym => {
                  const [y, m] = ym.split('-');
                  const active = ym === selected;
                  return (
                    <button
                      key={ym}
                      onClick={() => setFriendArchiveMonth(ym)}
                      style={{
                        flexShrink: 0, padding: '7px 14px', fontSize: '13px', fontWeight: active ? '700' : '400',
                        borderRadius: radius.full, border: 'none', cursor: 'pointer',
                        background: active ? C.accent : 'rgba(255,255,255,0.85)',
                        color: active ? 'white' : C.text,
                        boxShadow: active ? `0 2px 10px rgba(2,136,209,0.35)` : 'none',
                      }}
                    >{y}年{parseInt(m)}月</button>
                  );
                })}
              </div>

              {/* グリッド */}
              {selected && byMonth[selected] && (
                <>
                  <p style={{ fontSize: '13px', color: C.sub, marginBottom: '10px', fontWeight: '600' }}>
                    {selected.split('-')[0]}年{parseInt(selected.split('-')[1])}月 — {byMonth[selected].length}枚
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    {byMonth[selected].map((post, i) => (
                      <div key={i} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: radius.sm }}>
                        <img src={post.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={post.posted_at} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.45))', padding: '10px 4px 4px' }}>
                          <p style={{ color: 'white', fontSize: '9px', textAlign: 'center' }}>{post.posted_at.slice(5).replace('-', '/')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <BottomNav />
      </main>
    );
  }

  // ── 友達管理画面 ──────────────────────────────────────────
  if (screen === 'friends') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      <div style={s.header}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: C.accent }}>👥 友達</h2>
        <button
          onClick={() => setScreen('search')}
          style={{ background: C.accent, border: 'none', color: 'white', padding: '7px 16px', borderRadius: radius.sm, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >🔍 探す</button>
      </div>

      <div style={{ padding: '20px 18px' }}>
        {/* フレンド申請 */}
        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ color: C.accent, fontWeight: '700', marginBottom: '12px', fontSize: '14px' }}>📩 フレンド申請 {pendingRequests.length}件</p>
            {pendingRequests.map(r => (
              <div key={r.id} style={{ ...s.card({ padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar name={r.requester.display_name} />
                  <div>
                    <p style={{ fontWeight: '600', color: C.text, fontSize: '15px' }}>{r.requester.display_name}</p>
                    <p style={{ color: C.sub, fontSize: '12px' }}>@{r.requester.username}</p>
                  </div>
                </div>
                <button onClick={() => acceptFriendRequest(r.id, userId)} style={{ padding: '8px 18px', background: C.accent, border: 'none', borderRadius: radius.sm, color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>承認</button>
              </div>
            ))}
          </div>
        )}

        {/* 友達なし */}
        {friends.length === 0 && pendingRequests.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '70px' }}>
            <p style={{ fontSize: '56px', marginBottom: '16px' }}>👥</p>
            <p style={{ color: C.text, opacity: 0.55, fontSize: '15px' }}>まだ友達がいません</p>
            <p style={{ color: C.sub, fontSize: '13px', marginTop: '8px' }}>「探す」から友達を見つけよう</p>
          </div>
        )}

        {/* 友達リスト */}
        {friends.length > 0 && (
          <>
            <p style={{ color: C.sub, fontSize: '13px', marginBottom: '10px' }}>{friends.length}人のフレンド</p>
            {friends.map(f => (
              <button
                key={f.id}
                onClick={() => openFriendArchive(f)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '8px', textAlign: 'left' }}
              >
                <div style={{ ...s.card({ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={f.display_name} />
                    <div>
                      <p style={{ fontWeight: '600', color: C.text, fontSize: '15px' }}>{f.display_name}</p>
                      <p style={{ color: C.sub, fontSize: '12px' }}>@{f.username}</p>
                    </div>
                  </div>
                  <span style={{ color: C.subLight, fontSize: '18px' }}>›</span>
                </div>
              </button>
            ))}
          </>
        )}

      </div>
      <BottomNav />
    </main>
  );

  // ── 友達の投稿画面 ────────────────────────────────────────
  if (screen === 'friendsposts') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif', paddingBottom: '88px' }}>
      <div style={s.header}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: C.accent }}>🌅 友達の投稿</h2>
      </div>
      <div style={{ padding: '20px 18px' }}>
        {friendsPosts.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '70px' }}>
            <p style={{ fontSize: '56px', marginBottom: '16px' }}>🌅</p>
            <p style={{ color: C.text, opacity: 0.55, fontSize: '15px' }}>友達の今日の投稿はまだありません</p>
            <p style={{ color: C.sub, fontSize: '13px', marginTop: '8px' }}>友達が投稿すると、ここに表示されます</p>
          </div>
        ) : (
          friendsPosts.map((post, i) => (
            <div key={i} style={{ marginBottom: '16px', ...s.card({ overflow: 'hidden' }) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px 8px' }}>
                <Avatar name={post.display_name} />
                <div>
                  <p style={{ fontWeight: '600', color: C.text, fontSize: '14px' }}>{post.display_name}</p>
                  <p style={{ color: C.sub, fontSize: '11px' }}>今日の1枚</p>
                </div>
              </div>
              <img src={post.image_url} style={{ width: '100%', display: 'block' }} alt="友達の投稿" />
              <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => toggleLike(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: '1' }}>
                  {likes.find(l => l.post_id === post.id)?.liked ? '❤️' : '🤍'}
                </button>
                <span style={{ color: C.sub, fontSize: '13px', fontWeight: '500' }}>
                  {likes.find(l => l.post_id === post.id)?.count || 0}
                </span>
                <button onClick={() => setOpenComments(openComments === post.id ? null : post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', marginLeft: '4px', lineHeight: '1' }}>💬</button>
                <span style={{ color: C.sub, fontSize: '13px' }}>{(comments[post.id] || []).length}</span>
              </div>
              {openComments === post.id && (
                <div style={{ padding: '0 14px 12px', borderTop: `0.5px solid ${C.subLight}` }}>
                  <p style={{ fontSize: '11px', color: C.sub, padding: '8px 0 6px', fontWeight: '700' }}>
                    💬 {post.display_name}の投稿 ({(comments[post.id] || []).length}件)
                  </p>
                  {(comments[post.id] || []).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: radius.full, background: c.user_id === userId ? `linear-gradient(135deg, ${C.accent}, ${C.sub})` : C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: c.user_id === userId ? 'white' : C.accent, flexShrink: 0 }}>
                        {c.display_name[0]}
                      </div>
                      <div style={{ background: c.user_id === userId ? C.accentSoft : 'rgba(0,0,0,0.03)', borderRadius: radius.md, padding: '6px 10px', flex: 1 }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: C.accent, marginBottom: '2px' }}>{c.display_name}</p>
                        <p style={{ fontSize: '13px', color: C.text }}>{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      value={commentInput[post.id] || ''}
                      onChange={e => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                      placeholder="コメントを入力..."
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: radius.full, border: `1px solid ${C.subLight}`, background: 'rgba(255,255,255,0.9)', color: C.text, outline: 'none' }}
                    />
                    <button onClick={() => addComment(post.id)} style={{ background: C.accent, border: 'none', borderRadius: radius.full, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>送信</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </main>
  );

  // ── ユーザー検索画面 ──────────────────────────────────────
  if (screen === 'search') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif' }}>
      <div style={s.header}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: C.accent }}>🔍 ユーザー検索</h2>
        <button onClick={() => setScreen('friends')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '14px' }}>← 戻る</button>
      </div>
      <div style={{ padding: '20px 18px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
            placeholder="ユーザーIDで検索"
            style={{ ...s.input, flex: 1 }}
          />
          <button onClick={searchUsers} style={{ padding: '13px 20px', background: C.accent, border: 'none', borderRadius: radius.md, color: 'white', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>検索</button>
        </div>
        {searchResults.map(u => {
          const isFriend = friends.some(f => f.id === u.id);
          const isPending = sentRequests.has(u.id);
          return (
          <div key={u.id} style={{ ...s.card({ padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar name={u.display_name} />
              <div>
                <p style={{ fontWeight: '600', color: C.text, fontSize: '15px' }}>{u.display_name}</p>
                <p style={{ color: C.sub, fontSize: '12px' }}>@{u.username}</p>
              </div>
            </div>
            {isFriend ? (
              <span style={{ padding: '7px 14px', background: C.accentSoft, borderRadius: radius.sm, color: C.accent, fontSize: '13px', fontWeight: '700' }}>友達 ✓</span>
            ) : isPending ? (
              <span style={{ padding: '7px 14px', background: 'rgba(0,0,0,0.05)', borderRadius: radius.sm, color: C.sub, fontSize: '13px' }}>申請済み</span>
            ) : (
              <button onClick={() => sendFriendRequest(u.id)} style={{ padding: '8px 18px', background: C.accent, border: 'none', borderRadius: radius.sm, color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>申請</button>
            )}
          </div>
          );
        })}
        {searchResults.length === 0 && searchQuery && (
          <p style={{ textAlign: 'center', color: C.sub, marginTop: '40px', fontSize: '14px' }}>ユーザーが見つかりませんでした</p>
        )}
      </div>
    </main>
  );

  // ── プロフィール画面 ──────────────────────────────────────
  if (screen === 'profile') return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      <div style={s.header}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: C.accent }}>👤 プロフィール</h2>
        {!isEditingProfile && (
          <button onClick={() => { setEditDisplayName(displayName); setEditSchool(school); setIsEditingProfile(true); }} style={{ background: 'none', border: `1px solid ${C.accent}`, color: C.accent, padding: '6px 14px', borderRadius: radius.sm, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>編集</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: '20px' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: radius.full, background: `linear-gradient(135deg, ${C.sub}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', boxShadow: `0 4px 16px rgba(2,136,209,0.3)` }}>
          {displayName ? displayName[0] : '?'}
        </div>
        {isEditingProfile ? (
          <div style={{ ...s.card({ padding: '20px', width: '100%', maxWidth: '360px' }), display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '12px', color: C.sub, marginBottom: '6px', fontWeight: '600' }}>表示名</p>
              <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} style={s.input} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: C.sub, marginBottom: '6px', fontWeight: '600' }}>学校名（任意）</p>
              <input value={editSchool} onChange={e => setEditSchool(e.target.value)} placeholder="学校名" style={s.input} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveProfile} style={{ ...s.btn(), flex: 1 }}>保存</button>
              <button onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '15px', fontSize: '16px', fontWeight: '700', borderRadius: radius.lg, border: `1px solid ${C.subLight}`, background: C.white, color: C.sub, cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '22px', color: C.text }}>{displayName}</p>
            <p style={{ color: C.sub, fontSize: '14px', marginTop: '4px' }}>@{username}</p>
            {school && <p style={{ color: C.text, fontSize: '14px', marginTop: '6px', opacity: 0.7 }}>🏫 {school}</p>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '360px' }}>
          <div style={{ ...s.card({ flex: '1' as React.CSSProperties['flex'], padding: '16px', textAlign: 'center' }) }}>
            <p style={{ fontSize: '28px', fontWeight: '700', color: C.accent }}>{postedDates.length}</p>
            <p style={{ fontSize: '12px', color: C.sub, marginTop: '4px' }}>投稿数</p>
          </div>
          <div style={{ ...s.card({ flex: '1' as React.CSSProperties['flex'], padding: '16px', textAlign: 'center' }) }}>
            <p style={{ fontSize: '28px', fontWeight: '700', color: C.accent }}>{streak}</p>
            <p style={{ fontSize: '12px', color: C.sub, marginTop: '4px' }}>連続投稿</p>
          </div>
          <div style={{ ...s.card({ flex: '1' as React.CSSProperties['flex'], padding: '16px', textAlign: 'center' }) }}>
            <p style={{ fontSize: '28px', fontWeight: '700', color: C.accent }}>{friends.length}</p>
            <p style={{ fontSize: '12px', color: C.sub, marginTop: '4px' }}>友達</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );

  // ── カメラ画面 ────────────────────────────────────────────
  if (screen === 'camera') {
    if (todayPost) return null;
    return (
      <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
        <div style={{ background: C.white, borderRadius: radius.xl, padding: '44px 32px', boxShadow: '0 8px 40px rgba(2,136,209,0.12)', textAlign: 'center', width: '100%', maxWidth: '340px' }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>📷</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: C.accent }}>今日の1枚</h2>
          <p style={{ color: C.sub, fontSize: '13px', marginBottom: '32px' }}>この写真は今日だけ見られます</p>
          <input
            type="file" accept="image/*" capture="environment"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const { data: session } = await supabase.auth.getSession();
              if (!session.session) return;
              const uid = session.session.user.id;
              const path = `${uid}/${new Date().toISOString().split('T')[0]}.jpg`;
              const compressed = await compressImage(file);
              const { error } = await supabase.storage.from('posts').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
              if (error) { alert('アップロード失敗: ' + error.message); return; }
              const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
              await supabase.from('posts').upsert({ user_id: uid, image_url: urlData.publicUrl, posted_at: new Date().toISOString().split('T')[0] });
              await fetchTodayPost(uid);
              await fetchPostedDates(uid);
              setScreen('home');
            }}
            style={{ display: 'none' }} id="camera-input"
          />
          <label
            htmlFor="camera-input"
            style={{ display: 'inline-block', padding: '16px 40px', fontSize: '16px', fontWeight: '700', background: C.accent, borderRadius: radius.full, cursor: 'pointer', color: 'white', boxShadow: `0 4px 20px rgba(2,136,209,0.4)` }}
          >
            📷 写真を撮る
          </label>
          <br />
          <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: '14px', marginTop: '20px' }}>← 戻る</button>
        </div>
      </main>
    );
  }

  // ── ホーム画面 ────────────────────────────────────────────
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysUntilGraduation = graduationDate
    ? Math.ceil((new Date(graduationDate).getTime() - todayMidnight) / (1000 * 60 * 60 * 24))
    : null;
  const showCountdown = !isGraduated && daysUntilGraduation !== null && daysUntilGraduation >= 0 && daysUntilGraduation <= 365;
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const thisMonthCount = postedDates.filter(d => d.startsWith(monthStr)).length;

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', color: C.text, fontFamily: 'sans-serif', paddingBottom: '88px' }}>
      {/* ヘッダー */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📸</span>
          <span style={{ fontSize: '18px', fontWeight: '700', color: C.accent }}>青春snap</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: C.sub }}>@{username}</span>
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${C.subLight}`, color: C.sub, cursor: 'pointer', fontSize: '12px', padding: '4px 10px', borderRadius: radius.sm }}>ログアウト</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 18px', overflowY: 'auto' }}>

        {/* ストリーク */}
        {streak > 0 && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '16px', background: C.accentSoft, borderRadius: radius.lg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: `0.5px solid rgba(2,136,209,0.2)` }}>
            <span style={{ fontSize: '24px' }}>🔥</span>
            <div>
              <p style={{ fontWeight: '700', color: C.accent, fontSize: '15px' }}>{streak}日連続投稿中！</p>
              <p style={{ color: C.sub, fontSize: '12px' }}>この調子で続けよう</p>
            </div>
          </div>
        )}

        {/* 卒業カウントダウン */}
        {showCountdown && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '16px', background: 'linear-gradient(135deg, rgba(2,136,209,0.12), rgba(79,195,247,0.15))', borderRadius: radius.lg, padding: '16px 20px', border: `0.5px solid rgba(2,136,209,0.25)`, textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: C.sub, fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' }}>卒業まで</p>
            <p style={{ fontSize: '48px', fontWeight: '800', color: C.accent, lineHeight: 1, marginBottom: '4px' }}>{daysUntilGraduation}</p>
            <p style={{ fontSize: '14px', color: C.text, fontWeight: '600' }}>日</p>
          </div>
        )}

        {/* 卒業おめでとう＋月別アーカイブ */}
        {isGraduated && (() => {
          const byMonth: Record<string, { image_url: string; posted_at: string }[]> = {};
          for (const p of allPosts) {
            const ym = p.posted_at.slice(0, 7);
            if (!byMonth[ym]) byMonth[ym] = [];
            byMonth[ym].push(p);
          }
          const months = Object.keys(byMonth).sort();
          const selected = archiveMonth ?? months[months.length - 1] ?? null;
          return (
            <div style={{ width: '100%', maxWidth: '360px', marginBottom: '20px' }}>
              <div style={{ background: C.gold, borderRadius: radius.lg, padding: '22px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '36px', marginBottom: '8px' }}>🎓</p>
                <p style={{ fontWeight: '700', color: 'white', fontSize: '18px', marginBottom: '4px' }}>卒業おめでとう！</p>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>青春の記録が全部解放されました</p>
              </div>

              {/* 月セレクター */}
              <div style={{ overflowX: 'auto', display: 'flex', gap: '8px', paddingBottom: '4px', marginBottom: '16px' }}>
                {months.map(ym => {
                  const [y, m] = ym.split('-');
                  const active = ym === selected;
                  return (
                    <button
                      key={ym}
                      onClick={() => setArchiveMonth(ym)}
                      style={{
                        flexShrink: 0, padding: '7px 14px', fontSize: '13px', fontWeight: active ? '700' : '400',
                        borderRadius: radius.full, border: 'none', cursor: 'pointer',
                        background: active ? C.accent : 'rgba(255,255,255,0.85)',
                        color: active ? 'white' : C.text,
                        boxShadow: active ? `0 2px 10px rgba(2,136,209,0.35)` : 'none',
                      }}
                    >{y}年{parseInt(m)}月</button>
                  );
                })}
              </div>

              {/* 選択月のグリッド */}
              {selected && byMonth[selected] && (
                <>
                  <p style={{ fontSize: '13px', color: C.sub, marginBottom: '10px', fontWeight: '600' }}>
                    {selected.split('-')[0]}年{parseInt(selected.split('-')[1])}月 — {byMonth[selected].length}枚
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    {byMonth[selected].map((post, i) => (
                      <div key={i} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: radius.sm }}>
                        <img src={post.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={post.posted_at} />
                        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'linear-gradient(transparent, rgba(0,0,0,0.45))', padding: '10px 4px 4px' }}>
                          <p style={{ color: 'white', fontSize: '9px', textAlign: 'center' }}>{post.posted_at.slice(5).replace('-', '/')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* マイ投稿 */}
        <>
            {/* カレンダー */}
            <div style={{ width: '100%', maxWidth: '360px', marginBottom: '18px', ...s.card({ padding: '16px' }) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <p style={{ color: C.accent, fontWeight: '700', fontSize: '14px' }}>
                  📅 {year}年{month + 1}月
                </p>
                <p style={{ color: C.sub, fontSize: '12px' }}>今月 {thisMonthCount}日投稿 🌟</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                  <div key={d} style={{ fontSize: '11px', color: C.sub, paddingBottom: '6px', fontWeight: '600' }}>{d}</div>
                ))}
                {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
                  const hasPost = postedDates.includes(dateStr);
                  const isToday = day === today.getDate();
                  return (
                    <div key={day} style={{
                      padding: '5px 0', fontSize: '12px', borderRadius: radius.full,
                      background: hasPost ? C.accent : isToday ? C.accentSoft : 'transparent',
                      color: hasPost ? 'white' : isToday ? C.accent : C.text,
                      fontWeight: isToday ? '700' : '400',
                    }}>{day}</div>
                  );
                })}
              </div>
            </div>

            {/* 今日の投稿 */}
            {todayPost ? (
              <div style={{ width: '100%', maxWidth: '360px', marginBottom: '20px', ...s.card({ overflow: 'hidden' }) }}>
                <img src={todayPost.image_url} style={{ width: '100%', display: 'block' }} alt="今日の投稿" />
                <p style={{ color: C.sub, fontSize: '13px', padding: '12px', textAlign: 'center' }}>✨ 今日の1枚</p>
              </div>
            ) : !isGraduated && (
              <div style={{ width: '100%', maxWidth: '360px', marginTop: '8px', ...s.card({ padding: '24px', textAlign: 'center', border: `1.5px dashed ${C.sub}`, background: 'rgba(255,255,255,0.6)' }) }}>
                <div style={{ fontSize: '56px', marginBottom: '12px' }}>📷</div>
                <p style={{ color: C.text, fontWeight: '600', marginBottom: '6px', fontSize: '15px' }}>今日まだ投稿していません</p>
                <p style={{ color: C.sub, fontSize: '13px', marginBottom: '20px' }}>この写真は今日だけ見られます</p>
                <button onClick={() => setScreen('camera')} style={{ ...s.btn(), maxWidth: '200px', margin: '0 auto', padding: '13px 24px' }}>
                  📷 今日の1枚を撮る
                </button>
              </div>
            )}
          </>


      </div>

      <BottomNav />
    </main>
  );
}
