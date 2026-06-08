'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Screen = 'top' | 'login' | 'register' | 'setup' | 'home' | 'camera' | 'friends' | 'search';

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
  const [todayPost, setTodayPost] = useState<{image_url: string} | null>(null);
  const [userId, setUserId] = useState('');
  const [friends, setFriends] = useState<{id: string; display_name: string; username: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string; display_name: string; username: string}[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{id: string; requester: {id: string; display_name: string; username: string}}[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<{id: string; image_url: string; user_id: string; display_name: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'mypost' | 'friends'>('mypost');
  const [allPosts, setAllPosts] = useState<{image_url: string; posted_at: string}[]>([]);
  const [isGraduated, setIsGraduated] = useState(false);
  const [daysUntilGraduation, setDaysUntilGraduation] = useState<number | null>(null);
  const [postedDates, setPostedDates] = useState<string[]>([]);
  const [likes, setLikes] = useState<{post_id: string; count: number; liked: boolean}[]>([]);
  const [streak, setStreak] = useState(0);

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

  const fetchLikes = async (uid: string, posts: {id: string}[]) => {
    if (posts.length === 0) return;
    const postIds = posts.map(p => p.id);
    const { data } = await supabase.from('likes').select('*').in('post_id', postIds);
    if (data) {
      const likesData = postIds.map(pid => ({
        post_id: pid,
        count: data.filter(l => l.post_id === pid).length,
        liked: data.some(l => l.post_id === pid && l.user_id === uid),
      }));
      setLikes(likesData);
    }
  };

  const toggleLike = async (postId: string) => {
    const existing = likes.find(l => l.post_id === postId);
    if (existing?.liked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    }
    setLikes(prev => prev.map(l => l.post_id === postId ? {
      ...l,
      count: existing?.liked ? l.count - 1 : l.count + 1,
      liked: !l.liked,
    } : l));
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
      const mappedPosts = posts.map(p => ({ ...p, display_name: p.user?.display_name || '' }));
      setFriendsPosts(mappedPosts);
      await fetchLikes(uid, mappedPosts);
    }
  };

  const checkGraduation = async (uid: string) => {
    const { data: user } = await supabase.from('users').select('graduation_date').eq('id', uid).single();
    if (!user?.graduation_date) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const gradDate = new Date(user.graduation_date); gradDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((gradDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) {
      setIsGraduated(true);
      const { data: posts } = await supabase.from('posts').select('*').eq('user_id', uid).order('posted_at', { ascending: true });
      if (posts) setAllPosts(posts);
    } else {
      setDaysUntilGraduation(diff);
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
        const expectedStr = expected.toISOString().split('T')[0];
        if (dates[i] === expectedStr) { count++; } else { break; }
      }
      setStreak(count);
    }
  };

  const acceptFriendRequest = async (friendshipId: string, uid: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await fetchFriends(uid);
    await fetchPendingRequests(uid);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', userId);
    if (data) setSearchResults(data);
  };

  const sendFriendRequest = async (receiverId: string) => {
    await supabase.from('friendships').insert({ requester_id: userId, receiver_id: receiverId, status: 'pending' });
    alert('フレンド申請を送りました！');
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: user } = await supabase.from('users').select('*').eq('id', data.session.user.id).single();
        if (user?.username) {
          setUsername(user.username);
          setUserId(data.session.user.id);
          await fetchTodayPost(data.session.user.id);
          await fetchFriendsPosts(data.session.user.id);
          await checkGraduation(data.session.user.id);
          await fetchPostedDates(data.session.user.id);
          setScreen('home');
        } else { setScreen('setup'); }
      }
    });
  }, []);

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
      setUsername(user.username); setUserId(data.user.id);
      await fetchTodayPost(data.user.id);
      await fetchFriendsPosts(data.user.id);
      await checkGraduation(data.user.id);
      await fetchPostedDates(data.user.id);
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
    setScreen('top'); setUsername(''); setTodayPost(null); setFriendsPosts([]); setIsGraduated(false); setAllPosts([]); setLikes([]);
  };

  const bg = 'linear-gradient(160deg, #e0f7fa 0%, #b2ebf2 40%, #e0f2f1 100%)';
  const card = 'rgba(255,255,255,0.85)';
  const accent = '#0288d1';
  const text = '#01579b';
  const subtext = '#4fc3f7';

  const inputCls: React.CSSProperties = {
    width: '100%', padding: '12px 16px', fontSize: '16px',
    borderRadius: '12px', border: `1.5px solid ${subtext}`,
    background: 'rgba(255,255,255,0.8)', color: text, outline: 'none',
  };

  const btnCls = (color = accent): React.CSSProperties => ({
    width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold',
    borderRadius: '12px', border: 'none', background: color,
    color: 'white', cursor: 'pointer', boxShadow: `0 4px 12px ${color}44`,
  });

  // ボトムナビ
  const BottomNav = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: `1px solid rgba(2,136,209,0.1)`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 20px', zIndex: 100 }}>
      <button onClick={() => { setActiveTab('mypost'); setScreen('home'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: screen === 'home' && activeTab === 'mypost' ? accent : subtext }}>
        <span style={{ fontSize: '24px' }}>📸</span>
        <span style={{ fontSize: '10px' }}>マイ投稿</span>
      </button>
      <button onClick={() => setScreen('camera')} style={{ background: accent, border: 'none', cursor: 'pointer', width: '56px', height: '56px', borderRadius: '50%', fontSize: '24px', marginTop: '-20px', boxShadow: `0 4px 16px ${accent}66` }}>
        📷
      </button>
      <button onClick={() => { setActiveTab('friends'); setScreen('home'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: (screen === 'home' && activeTab === 'friends') || screen === 'friends' || screen === 'search' ? accent : subtext }}>
        <span style={{ fontSize: '24px' }}>👥</span>
        <span style={{ fontSize: '10px' }}>友達</span>
      </button>
    </div>
  );

  if (screen === 'top') return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: text, padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '72px', marginBottom: '16px' }}>📸</div>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: accent }}>青春snap</h1>
      <p style={{ color: text, marginBottom: '8px', textAlign: 'center', opacity: 0.8 }}>毎日1枚。卒業の日に、全部開く。</p>
      <p style={{ color: subtext, fontSize: '13px', marginBottom: '48px', textAlign: 'center' }}>今日の写真は今日だけ見られる。</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <button onClick={() => setScreen('register')} style={btnCls()}>はじめる</button>
        <button onClick={() => setScreen('login')} style={{ ...btnCls(), background: 'white', color: accent, boxShadow: `0 4px 12px rgba(2,136,209,0.15)` }}>ログイン</button>
      </div>
    </main>
  );

  if (screen === 'login' || screen === 'register') return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: text, padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: card, borderRadius: '24px', padding: '32px', boxShadow: '0 8px 32px rgba(2,136,209,0.1)' }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>📸</div>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: accent }}>
          {screen === 'login' ? 'ログイン' : 'アカウント作成'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" type="email" style={inputCls} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード（6文字以上）" type="password" style={inputCls} />
          {error && <p style={{ color: '#e53935', fontSize: '13px' }}>{error}</p>}
          <button onClick={screen === 'login' ? login : register} disabled={loading} style={btnCls()}>
            {loading ? '...' : screen === 'login' ? 'ログイン' : '登録'}
          </button>
          <button onClick={() => { setScreen('top'); setError(''); }} style={{ background: 'none', border: 'none', color: subtext, cursor: 'pointer', fontSize: '14px' }}>← 戻る</button>
        </div>
      </div>
    </main>
  );

  if (screen === 'setup') return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: text, padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: card, borderRadius: '24px', padding: '32px', boxShadow: '0 8px 32px rgba(2,136,209,0.1)' }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>✏️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: accent }}>プロフィール設定</h2>
        <p style={{ color: subtext, fontSize: '13px', marginBottom: '24px', textAlign: 'center' }}>卒業日を設定してください</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ユーザーID（例：taro_2025）" style={inputCls} />
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="表示名（例：たろう）" style={inputCls} />
          <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="学校名（任意）" style={inputCls} />
          <div>
            <p style={{ fontSize: '13px', color: subtext, marginBottom: '6px' }}>卒業予定日</p>
            <input value={graduationDate} onChange={(e) => setGraduationDate(e.target.value)} type="date" style={inputCls} />
          </div>
          {error && <p style={{ color: '#e53935', fontSize: '13px' }}>{error}</p>}
          <button onClick={setup} style={btnCls()}>青春をはじめる 🌸</button>
        </div>
      </div>
    </main>
  );

  if (screen === 'friends') return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', color: text, fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderBottom: `1px solid rgba(2,136,209,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: accent }}>👥 友達</h2>
        <button onClick={() => setScreen('search')} style={{ background: accent, border: 'none', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>🔍 探す</button>
      </div>
      <div style={{ padding: '20px' }}>
        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: accent, fontWeight: 'bold', marginBottom: '12px' }}>📩 フレンド申請</p>
            {pendingRequests.map(r => (
              <div key={r.id} style={{ padding: '16px', background: card, borderRadius: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(2,136,209,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '36px' }}>👤</div>
                  <div>
                    <p style={{ fontWeight: 'bold', color: text }}>{r.requester.display_name}</p>
                    <p style={{ color: subtext, fontSize: '13px' }}>@{r.requester.username}</p>
                  </div>
                </div>
                <button onClick={() => acceptFriendRequest(r.id, userId)} style={{ padding: '8px 16px', background: accent, border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>承認</button>
              </div>
            ))}
          </div>
        )}
        {friends.length === 0 && pendingRequests.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>👥</p>
            <p style={{ color: text, opacity: 0.6 }}>まだ友達がいません</p>
            <p style={{ color: subtext, fontSize: '13px', marginTop: '8px' }}>「探す」から友達を見つけよう</p>
          </div>
        )}
        {friends.map(f => (
          <div key={f.id} style={{ padding: '16px', background: card, borderRadius: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(2,136,209,0.1)' }}>
            <div style={{ fontSize: '36px' }}>👤</div>
            <div>
              <p style={{ fontWeight: 'bold', color: text }}>{f.display_name}</p>
              <p style={{ color: subtext, fontSize: '13px' }}>@{f.username}</p>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );

  if (screen === 'search') return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', color: text, fontFamily: 'sans-serif' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderBottom: `1px solid rgba(2,136,209,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: accent }}>🔍 ユーザー検索</h2>
        <button onClick={() => setScreen('friends')} style={{ background: 'none', border: 'none', color: subtext, cursor: 'pointer', fontSize: '14px' }}>← 戻る</button>
      </div>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchUsers()} placeholder="ユーザーIDで検索" style={{ ...inputCls, flex: 1 }} />
          <button onClick={searchUsers} style={{ padding: '12px 20px', background: accent, border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer', fontSize: '16px' }}>検索</button>
        </div>
        {searchResults.map(u => (
          <div key={u.id} style={{ padding: '16px', background: card, borderRadius: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(2,136,209,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '36px' }}>👤</div>
              <div>
                <p style={{ fontWeight: 'bold', color: text }}>{u.display_name}</p>
                <p style={{ color: subtext, fontSize: '13px' }}>@{u.username}</p>
              </div>
            </div>
            <button onClick={() => sendFriendRequest(u.id)} style={{ padding: '8px 16px', background: accent, border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>申請</button>
          </div>
        ))}
      </div>
    </main>
  );

  if (screen === 'camera') {
    if (todayPost) { setScreen('home'); return null; }
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: text, fontFamily: 'sans-serif', padding: '20px' }}>
        <div style={{ background: card, borderRadius: '24px', padding: '40px', boxShadow: '0 8px 32px rgba(2,136,209,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📷</div>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px', color: accent }}>今日の1枚</h2>
          <p style={{ color: subtext, fontSize: '13px', marginBottom: '24px' }}>この写真は今日だけ見られます</p>
          <input type="file" accept="image/*" capture="environment"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const { data: session } = await supabase.auth.getSession();
              if (!session.session) return;
              const uid = session.session.user.id;
              const path = `${uid}/${new Date().toISOString().split('T')[0]}.jpg`;
              const { error } = await supabase.storage.from('posts').upload(path, file, { upsert: true });
              if (error) { alert('アップロード失敗: ' + error.message); return; }
              const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
              await supabase.from('posts').upsert({ user_id: uid, image_url: urlData.publicUrl, posted_at: new Date().toISOString().split('T')[0] });
              await fetchTodayPost(uid);
              await fetchPostedDates(uid);
              setScreen('home');
            }}
            style={{ display: 'none' }} id="camera-input"
          />
          <label htmlFor="camera-input" style={{ display: 'inline-block', padding: '16px 40px', fontSize: '18px', background: accent, borderRadius: '50px', cursor: 'pointer', color: 'white', boxShadow: `0 4px 16px ${accent}44` }}>
            📷 写真を選ぶ・撮る
          </label>
          <br />
          <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none', color: subtext, cursor: 'pointer', fontSize: '14px', marginTop: '16px' }}>← 戻る</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', color: text, fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderBottom: `1px solid rgba(2,136,209,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: accent }}>📸 青春snap</h1>
        <button onClick={logout} style={{ background: 'none', border: 'none', color: subtext, cursor: 'pointer', fontSize: '14px' }}>ログアウト</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: subtext, fontSize: '13px' }}>@{username}</p>
          {streak > 0 && (
            <p style={{ color: accent, fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>🔥 {streak}日連続投稿中！</p>
          )}
        </div>
        {!isGraduated && daysUntilGraduation !== null && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '16px', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 16px rgba(2,136,209,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: subtext, fontSize: '12px', marginBottom: '4px' }}>卒業まで</p>
              <p style={{ color: accent, fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}>
                あと <span style={{ fontSize: '36px' }}>{daysUntilGraduation}</span> 日
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: subtext, fontSize: '12px', marginBottom: '4px' }}>青春の記録</p>
              <p style={{ color: accent, fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}>
                <span style={{ fontSize: '36px' }}>{postedDates.length}</span> 枚
              </p>
            </div>
          </div>
        )}
        {activeTab === 'mypost' && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '20px', background: card, borderRadius: '20px', padding: '16px', boxShadow: '0 4px 16px rgba(2,136,209,0.1)' }}>
            <p style={{ color: accent, fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              📅 {new Date().getFullYear()}年{new Date().getMonth() + 1}月
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
              {['日','月','火','水','木','金','土'].map(d => (
                <div key={d} style={{ fontSize: '11px', color: subtext, paddingBottom: '4px' }}>{d}</div>
              ))}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }, (_, i) => {
                const day = i + 1;
                const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasPost = postedDates.includes(dateStr);
                const isToday = day === new Date().getDate();
                return (
                  <div key={day} style={{ padding: '4px 0', fontSize: '12px', borderRadius: '50%', background: hasPost ? accent : isToday ? 'rgba(2,136,209,0.1)' : 'transparent', color: hasPost ? 'white' : isToday ? accent : text, fontWeight: isToday ? 'bold' : 'normal' }}>{day}</div>
                );
              })}
            </div>
            <p style={{ color: subtext, fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>
              今月 {postedDates.filter(d => d.startsWith(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)).length}日投稿済み 🌟
            </p>
          </div>
        )}
        {isGraduated && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #ffd700, #ff8c00)', borderRadius: '20px', padding: '20px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 16px rgba(255,215,0,0.3)' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎓</p>
              <p style={{ fontWeight: 'bold', color: 'white', fontSize: '18px', marginBottom: '4px' }}>卒業おめでとう！</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>青春の記録が全部解放されました</p>
            </div>
            {allPosts.map((post, i) => (
              <div key={i} style={{ marginBottom: '16px', background: card, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(2,136,209,0.1)' }}>
                <p style={{ color: subtext, fontSize: '13px', padding: '12px 16px 8px' }}>📅 {post.posted_at}</p>
                <img src={post.image_url} style={{ width: '100%' }} />
              </div>
            ))}
          </div>
        )}
        {activeTab === 'mypost' && todayPost && (
          <div style={{ marginBottom: '24px', width: '100%', maxWidth: '360px', background: card, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(2,136,209,0.1)' }}>
            <img src={todayPost.image_url} style={{ width: '100%' }} />
            <p style={{ color: subtext, fontSize: '13px', padding: '12px', textAlign: 'center' }}>今日の1枚 ✨</p>
          </div>
        )}
        {activeTab === 'friends' && friendsPosts.length > 0 && (
          <div style={{ width: '100%', maxWidth: '360px', marginBottom: '24px' }}>
            <p style={{ color: accent, fontWeight: 'bold', marginBottom: '12px' }}>👥 友達の今日</p>
            {friendsPosts.map((post, i) => (
              <div key={i} style={{ marginBottom: '16px', background: card, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(2,136,209,0.1)' }}>
                <p style={{ color: subtext, fontSize: '13px', padding: '12px 16px 8px' }}>📸 {post.display_name}</p>
                <img src={post.image_url} style={{ width: '100%' }} />
                <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => toggleLike(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                    {likes.find(l => l.post_id === post.id)?.liked ? '❤️' : '🤍'}
                  </button>
                  <span style={{ color: subtext, fontSize: '13px' }}>
                    {likes.find(l => l.post_id === post.id)?.count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'friends' && friendsPosts.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>👥</p>
            <p style={{ color: text, opacity: 0.6 }}>友達の今日の投稿はまだありません</p>
          </div>
        )}
        {activeTab === 'mypost' && !todayPost && !isGraduated && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div style={{ fontSize: '72px', marginBottom: '16px' }}>📷</div>
            <p style={{ color: text, opacity: 0.7, marginBottom: '8px' }}>今日の1枚を撮ろう</p>
            <p style={{ color: subtext, fontSize: '13px', marginBottom: '32px' }}>この写真は今日だけ見られます</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}