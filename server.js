require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');

const MAX_HP = 5;
const LIST_LIMIT = 500; // 한 번에 내려주는 순위표 최대 인원

// ---- Supabase (장기 저장소) ----
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되어 있으면 Supabase(Postgres)에
// 닉네임별 누적 최고 기록을 저장한다. 설정이 없으면 로컬 개발 편의를 위해
// data/leaderboard.json 파일로 자동 폴백한다 (단, 이 폴백은 배포 환경에서는
// 재배포/슬립 시 초기화될 수 있으니 실제 서비스에는 Supabase 설정이 필요하다).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  console.log('[leaderboard] Supabase에 연결됨 — 닉네임별 누적 기록이 장기 보존됩니다.');
} else {
  console.warn(
    '[leaderboard] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — ' +
    'data/leaderboard.json 로컬 파일로 폴백합니다 (재배포 시 초기화될 수 있음).'
  );
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- 로컬 파일 폴백 ----
function loadLocalList() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveLocalList(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list));
}

function sortEntries(list) {
  return [...list].sort((a, b) => {
    if (b.best_hp !== a.best_hp) return b.best_hp - a.best_hp;
    return a.best_achieved_at - b.best_achieved_at;
  });
}

// 닉네임별 최고 기록만 갱신하는 로컬 upsert (Supabase의 upsert_leaderboard 함수와 동일한 규칙).
function upsertLocal(list, name, hp) {
  const now = Date.now();
  const idx = list.findIndex((e) => e.name === name);
  if (idx === -1) {
    list.push({ name, best_hp: hp, total_wins: 1, first_achieved_at: now, best_achieved_at: now, updated_at: now });
  } else {
    const e = list[idx];
    e.total_wins += 1;
    if (hp > e.best_hp) {
      e.best_hp = hp;
      e.best_achieved_at = now;
    }
    e.updated_at = now;
  }
  return list;
}

// ---- 서버 <-> 클라이언트 공용 응답 형태로 변환 ----
function toClientShape(row) {
  const date = row.best_achieved_at instanceof Date
    ? row.best_achieved_at.getTime()
    : (typeof row.best_achieved_at === 'number' ? row.best_achieved_at : new Date(row.best_achieved_at).getTime());
  return { name: row.name, hp: row.best_hp, wins: row.total_wins, date };
}

app.get('/api/leaderboard', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('name, best_hp, total_wins, best_achieved_at')
      .order('best_hp', { ascending: false })
      .order('best_achieved_at', { ascending: true })
      .limit(LIST_LIMIT);

    if (error) {
      console.error('[leaderboard] GET 조회 실패:', error.message);
      return res.status(500).json({ error: 'leaderboard_unavailable' });
    }
    return res.json(data.map(toClientShape));
  }

  const list = sortEntries(loadLocalList()).slice(0, LIST_LIMIT);
  res.json(list.map(toClientShape));
});

app.post('/api/leaderboard', async (req, res) => {
  const { name, hp } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 10) : '';
  const cleanHp = Number(hp);

  if (!cleanName || !Number.isFinite(cleanHp) || cleanHp < 0 || cleanHp > MAX_HP) {
    return res.status(400).json({ error: 'invalid_entry' });
  }
  const roundedHp = Math.round(cleanHp);

  if (supabase) {
    const { error: upsertError } = await supabase.rpc('upsert_leaderboard', {
      p_name: cleanName,
      p_hp: roundedHp,
    });
    if (upsertError) {
      console.error('[leaderboard] POST upsert 실패:', upsertError.message);
      return res.status(500).json({ error: 'leaderboard_unavailable' });
    }

    const { data: listData, error: listError } = await supabase
      .from('leaderboard')
      .select('name, best_hp, total_wins, best_achieved_at')
      .order('best_hp', { ascending: false })
      .order('best_achieved_at', { ascending: true })
      .limit(LIST_LIMIT);
    if (listError) {
      console.error('[leaderboard] POST 이후 조회 실패:', listError.message);
      return res.status(500).json({ error: 'leaderboard_unavailable' });
    }

    const list = listData.map(toClientShape);
    const rank = list.findIndex((e) => e.name === cleanName) + 1;
    return res.json({ list, rank, name: cleanName });
  }

  const list = sortEntries(upsertLocal(loadLocalList(), cleanName, roundedHp));
  saveLocalList(list);
  const shaped = list.slice(0, LIST_LIMIT).map(toClientShape);
  const rank = shaped.findIndex((e) => e.name === cleanName) + 1;
  res.json({ list: shaped, rank, name: cleanName });
});

app.listen(PORT, () => {
  console.log(`똥 피하기 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
