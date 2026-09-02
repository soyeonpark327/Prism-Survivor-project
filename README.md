# Prism-Survivor-project — 똥 피하기

40초씩 3단계, 총 120초 동안 떨어지는 똥을 피하며 버티는 픽셀 아트 미니게임입니다. 단계가 오를수록 똥이 더 빠르고 촘촘하게 쏟아집니다.

- 갈색 똥(장애물)에 맞으면 체력이 1 감소, 컬러 똥(회복 아이템)을 먹으면 체력이 1 증가 (최대 5)
- 체력이 0이 되면 게임 오버, 3단계(120초)를 모두 버티면 승리
- 배경음악과 효과음(장애물: "드헉!", 회복: "예~")은 브라우저에서 직접 합성되며 외부 음원 파일을 쓰지 않습니다
- **명예의 전당**: 닉네임 기준으로 **누적 최고 기록**이 쌓이는 순위표입니다. 서버(`/api/leaderboard`)가 Supabase(Postgres)에 장기 저장하기 때문에 **모든 방문자가 같은 순위표를 공유**하고, 재배포/서버 재시작을 해도 기록이 유지됩니다 (1/2/3등은 금·은·동으로 표시, 내 순위가 10위 밖이면 화면 하단에 빨간 테두리로 항상 고정 표시, 같은 닉네임으로 여러 번 이기면 "N승 누적" 배지가 붙습니다)

## Supabase 설정 (닉네임별 누적 랭킹 장기 저장)

순위표는 Supabase 없이도(로컬 `data/leaderboard.json` 폴백) 동작하지만, **재배포/서버 재시작 시 초기화되므로 실제 서비스에는 Supabase 연동이 필요**합니다.

1. [supabase.com](https://supabase.com)에서 무료 프로젝트를 하나 만듭니다 (GitHub 계정으로 가입 가능, 카드 등록 불필요)
2. 프로젝트의 **SQL Editor**를 열고 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용 전체를 붙여넣어 실행합니다 (`leaderboard` 테이블 + 닉네임별 최고 기록만 갱신하는 `upsert_leaderboard` 함수가 생성됩니다)
3. **Project Settings → API**에서 `Project URL`과 `service_role` 키(⚠️ `anon` 키가 아닙니다)를 복사합니다
4. 로컬 개발: `.env.example`을 `.env`로 복사하고 값을 채웁니다 (`.env`는 git에 커밋되지 않습니다)
5. Render 배포: 아래 배포 단계에서 같은 두 값을 환경 변수로 등록합니다

Supabase 환경 변수가 설정되지 않으면 서버는 자동으로 로컬 JSON 파일로 폴백하며, 콘솔에 경고 로그를 남깁니다.

## 로컬 실행

```bash
npm install
cp .env.example .env   # Supabase 값 채우기 (건너뛰면 로컬 파일로 폴백)
npm start
```

브라우저에서 `http://localhost:3000` 접속.

## 배포 (Render)

이 저장소에는 `render.yaml`이 포함되어 있어 Render의 **Blueprint** 기능으로 바로 배포할 수 있습니다.

1. [Render 대시보드](https://dashboard.render.com)에서 **New +** → **Blueprint** 선택
2. 이 GitHub 저장소(`Prism-Survivor-project`) 연결
3. `render.yaml`이 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 값을 물어봅니다 — 위 Supabase 설정 단계에서 복사해둔 값을 입력합니다
4. **Apply** 클릭
5. 배포가 끝나면 Render가 제공하는 `https://xxxx.onrender.com` 링크로 접속

무료 플랜은 일정 시간 방치되면 서버가 잠들었다가 다음 요청 시 다시 깨어납니다(첫 요청이 몇십 초 느릴 수 있음). Supabase를 연동해두면 이때도 순위표 데이터는 그대로 유지됩니다.
