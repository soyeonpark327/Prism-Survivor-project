const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');

const MAX_HP = 5;
const HOF_STORAGE_CAP = 500; // 저장 상한 (사실상 전체 기록 보존용 안전장치)

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadList() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveList(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list));
}

function sortAndCap(list) {
  list.sort((a, b) => {
    if (b.hp !== a.hp) return b.hp - a.hp;
    return a.date - b.date;
  });
  return list.slice(0, HOF_STORAGE_CAP);
}

app.get('/api/leaderboard', (req, res) => {
  res.json(loadList());
});

app.post('/api/leaderboard', (req, res) => {
  const { name, hp } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 10) : '';
  const cleanHp = Number(hp);

  if (!cleanName || !Number.isFinite(cleanHp) || cleanHp < 0 || cleanHp > MAX_HP) {
    return res.status(400).json({ error: 'invalid_entry' });
  }

  const entry = {
    id: crypto.randomBytes(8).toString('hex'),
    name: cleanName,
    hp: Math.round(cleanHp),
    date: Date.now(),
  };

  const list = sortAndCap([...loadList(), entry]);
  saveList(list);

  const rank = list.findIndex((e) => e.id === entry.id) + 1;
  res.json({ list, id: entry.id, rank });
});

app.listen(PORT, () => {
  console.log(`똥 피하기 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
