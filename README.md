# 자유게시판

> 웹 개발을 배우기 위해 만든 게시판입니다. **CRUD의 전체 흐름**(브라우저 → 서버 → DB → 다시 화면)을 직접 만들어보며 이해하는 것이 목적입니다.

프레임워크를 일부러 쓰지 않았습니다. React도, Express도 없습니다. 브라우저와 서버가 실제로 무슨 일을 하는지 가려지지 않게 하기 위해서입니다.

---

## 무엇을 할 수 있나

게시글 하나에 대한 CRUD 네 가지가 전부입니다.

| 기능 | 설명 | CRUD |
|---|---|---|
| 글 목록 | 최신순 10개씩, 페이지 번호로 이동 | Read |
| 글 쓰기 | 제목·작성자·비밀번호·내용 | Create |
| 글 상세 | 본문 표시, 열 때마다 조회수 +1 | Read |
| 글 수정 | 비밀번호가 맞아야 저장 | Update |
| 글 삭제 | 비밀번호가 맞아야 삭제 | Delete |

로그인이 없습니다. 대신 글을 쓸 때 **비밀번호**를 함께 받아, 수정·삭제할 때 그 비밀번호를 확인합니다. 옛날 한국 게시판 방식입니다.

댓글·검색·파일첨부는 일부러 뺐습니다. 핵심 흐름을 확실히 익힌 뒤에 붙이는 편이 잘 배워지기 때문입니다.

---

## 스택

| 항목 | 선택 |
|---|---|
| 화면 | HTML + CSS + JavaScript (프레임워크 없음) |
| 통신 | `fetch`로 JSON 주고받기 |
| 서버 | Vercel Serverless Functions (Node.js) |
| DB | MongoDB Atlas (M0 무료 티어) |
| 라이브러리 | `mongodb`, `bcryptjs` |

프론트와 백엔드가 **모두 JavaScript**라 언어를 오갈 일이 없습니다.

---

## 데이터가 흐르는 길

글 목록을 보는 상황을 예로 들면 이렇게 흘러갑니다.

```
① 브라우저에서 index.html 열기
        ↓
② JS가 fetch('/api/posts?page=1') 호출
        ↓
③ Vercel이 api/posts/index.js 함수를 깨움
        ↓
④ 함수가 MongoDB Atlas에 "글 10개 줘" 요청
        ↓
⑤ DB가 문서 10개 반환
        ↓
⑥ 함수가 JSON으로 응답
        ↓
⑦ JS가 그 JSON을 받아 HTML 표로 그림
```

**서버는 데이터(JSON)만 보내고, 화면은 브라우저의 JS가 만듭니다.**

---

## API

주소는 둘인데 기능은 다섯입니다. 같은 주소라도 **HTTP 메서드가 다르면 다른 동작**이기 때문입니다.

| 메서드 | 주소 | 하는 일 |
|---|---|---|
| `GET` | `/api/posts?page=1` | 목록 (10개씩) |
| `POST` | `/api/posts` | 글 작성 |
| `GET` | `/api/posts/[id]` | 상세 (`?countView=1`이면 조회수 +1) |
| `PUT` | `/api/posts/[id]` | 수정 (비밀번호 확인) |
| `DELETE` | `/api/posts/[id]` | 삭제 (비밀번호 확인) |

에러는 형식을 통일했습니다.

```json
{ "error": "비밀번호가 일치하지 않습니다" }
```

| 코드 | 언제 |
|---|---|
| `200` / `201` / `204` | 성공 / 생성됨 / 성공(본문 없음) |
| `400` | 입력이 잘못됨 |
| `401` | 비밀번호 틀림 |
| `404` | 없는 글 |
| `405` | 허용되지 않는 메서드 |
| `500` | 서버 오류 |

---

## 폴더 구조

```
.
├── public/                  브라우저가 받는 파일들
│   ├── index.html               글 목록
│   ├── write.html               글쓰기
│   ├── view.html                글 상세
│   ├── edit.html                글 수정
│   ├── css/style.css            공통 스타일
│   └── js/
│       ├── api.js               서버 호출을 모아둔 곳
│       ├── format.js            날짜 표시 변환
│       ├── list.js              목록 화면
│       ├── write.js             글쓰기 화면
│       ├── view.js              상세 화면 (삭제 포함)
│       └── edit.js              수정 화면
│
├── api/posts/               서버리스 함수 (Vercel이 자동 인식)
│   ├── index.js                 GET 목록 · POST 작성
│   └── [id].js                  GET 상세 · PUT 수정 · DELETE 삭제
│
├── lib/
│   ├── db.js                    MongoDB 연결 (캐시)
│   └── validate.js              입력 검증 규칙
│
└── scripts/
    ├── create-index.js          인덱스 생성 (한 번만)
    └── seed.js                  페이징 확인용 더미 글
```

**화면 하나 = HTML 1개 + JS 1개.** "이 화면이 이상하다"가 곧 "이 파일을 고치면 된다"가 되도록 했습니다.

`api/` 폴더는 Vercel의 규칙입니다. 파일을 두면 자동으로 API 주소가 생깁니다. `[id].js`처럼 대괄호를 쓰면 주소의 그 자리 값을 꺼내 쓸 수 있습니다.

---

## 실행하기

### 준비물

- Node.js **20.6 이상** (`node -v`로 확인)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) 계정 (무료)
- [Vercel](https://vercel.com) 계정 (무료)

### 1. 내려받고 설치

```bash
git clone https://github.com/ssenu/Bulletin.git
cd Bulletin
npm install
npm install -g vercel
```

### 2. MongoDB Atlas 준비

1. M0 무료 클러스터 생성
2. **Database Access** → 사용자 추가 (권한: Read and write to any database)
3. **Network Access** → `0.0.0.0/0` 허용
   *Vercel 서버리스는 IP가 고정되지 않아 특정 IP만 열 수 없습니다. 긴 비밀번호가 방어선입니다.*
4. **Connect → Drivers → Node.js**에서 접속 문자열 복사

### 3. 환경변수

프로젝트 루트에 `.env.local`을 만듭니다.

```bash
MONGODB_URI=mongodb+srv://아이디:비밀번호@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

> 이 파일은 `.gitignore`에 있어 git에 올라가지 않습니다. **접속 정보를 GitHub에 올리면 봇이 몇 분 만에 찾아냅니다.**

### 4. 인덱스 생성 (한 번만)

```bash
node --env-file=.env.local scripts/create-index.js
```

### 5. 실행

```bash
vercel login
vercel dev
```

→ http://localhost:3000

> **HTML 파일을 더블클릭으로 열면 동작하지 않습니다.** `type="module"` 스크립트는 `file://`에서 실행되지 않습니다. 반드시 위 주소로 접속하세요.

### 페이징을 확인하고 싶다면

더미 글 15개를 넣는 스크립트가 있습니다. (비밀번호는 모두 `1234`)

```bash
node --env-file=.env.local scripts/seed.js
```

---

## 배포

1. [vercel.com/new](https://vercel.com/new)에서 이 저장소를 Import
2. Framework Preset: **Other**
3. **Environment Variables**에 `MONGODB_URI` 추가 (`.env.local`과 같은 값)
4. Deploy

`MONGODB_URI`를 빠뜨리면 배포는 되지만 모든 API가 500을 냅니다. 가장 흔한 실수입니다.

이후로는 `git push`만 하면 자동으로 재배포됩니다.

---

## 이 프로젝트로 배우는 것

- **HTTP** — GET/POST/PUT/DELETE의 의미, 상태 코드, 요청·응답 구조
- **REST API** — 주소와 메서드로 자원을 다루는 방식
- **CRUD** — DB의 insert / find / update / delete
- **비동기 JavaScript** — `fetch`, `async/await`
- **DOM 조작** — 데이터로 화면 그리기
- **NoSQL** — 문서형 DB, projection, `$inc`, 인덱스
- **서버리스** — 함수 단위 배포, 연결 재사용, 콜드 스타트
- **보안 기초** — 해싱, XSS, 서버 검증, 환경변수 관리

### 코드에 남겨둔 학습 포인트

**비밀번호는 해시해서 저장합니다.** 원문은 어디에도 남기지 않습니다.

```js
// 저장할 때
const passwordHash = await bcrypt.hash(password, 10);
// 확인할 때 — 해시를 되돌리는 게 아니라 같은 방식으로 해시해서 비교
const matched = await bcrypt.compare(input, post.passwordHash);
```

**화면에 표시할 땐 항상 `textContent`를 씁니다.**

```js
element.innerHTML = post.content;   // 본문의 <script>가 실행됨 (XSS)
element.textContent = post.content; // 글자 그대로 표시 — 안전
```

**검증은 서버가 진짜입니다.** 브라우저 검증은 개발자도구로 얼마든지 우회할 수 있습니다. `maxlength="100"`을 건너뛰고 200자를 보내도 서버가 막습니다.

**서버리스는 DB 연결을 재사용해야 합니다.** 요청마다 새로 연결하면 Atlas 무료 티어의 연결 한도(500개)를 금방 넘깁니다.

---

## 알아두어야 할 한계

**이 게시판의 비밀번호는 안전장치가 아닙니다.**

- bcrypt 해싱은 **DB가 통째로 유출됐을 때** 비밀번호 원문을 지켜줍니다. 거기까지입니다.
- 최소 4자에 **시도 횟수 제한이 없습니다.** 4자리 숫자면 경우의 수가 1만 개뿐이고, 목록 API가 모든 글의 `_id`를 알려줍니다.
- 즉 **마음먹으면 누구나 남의 글을 수정하거나 지울 수 있습니다.**

학습용으로는 충분하지만, **낯선 사람이 지워도 괜찮은 내용만 올리세요.**

그 밖에:
- 조회수는 인증 없이 올라가므로 조작할 수 있습니다
- 새로고침할 때마다 조회수가 오릅니다 (중복 방지 없음)
- 반응형 디자인이 아닙니다

---

## 문서

설계와 구현 과정을 문서로 남겨두었습니다.

| 문서 | 내용 |
|---|---|
| [설계 문서](docs/superpowers/specs/2026-07-28-board-crud-design.md) | 왜 이렇게 만들었는지. 스택 선택 근거와 설계 결정 8건의 이유 |
| [구현 계획](docs/superpowers/plans/2026-07-28-bulletin-board.md) | 어떤 순서로 만들었는지. 13개 태스크의 코드와 확인 방법 |

구현 계획은 **"확인(실패를 먼저 본다) → 구현 → 재확인 → 커밋"** 순서로 되어 있습니다. 처음부터 따라 만들어볼 수 있습니다.

---

## 다음에 붙여볼 것

| 과제 | 새로 배우는 것 | 난이도 |
|---|---|---|
| 제목·작성자 검색 | 조건부 조회(`$regex`) | 낮음 |
| 수정일시 표시 | 필드 추가, 조건부 표시 | 낮음 |
| 댓글 | 1:N 관계 | 중간 |
| 로그인·회원가입 | 세션 또는 JWT, 인증과 인가의 차이 | 높음 |
| 같은 게시판을 서버 렌더링으로 | SSR과 CSR의 차이를 몸으로 비교 | 중간 |

마지막 항목을 특히 추천합니다. 지금 만든 것과 똑같은 기능을 서버가 HTML을 만들어 보내는 방식으로 다시 만들면, 두 구조의 차이가 선명하게 보입니다.
