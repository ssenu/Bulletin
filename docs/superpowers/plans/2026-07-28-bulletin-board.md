# 게시판 CRUD 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 글 목록·작성·상세·수정·삭제가 동작하는 게시판을 만들고 인터넷에 배포한다.

**Architecture:** 브라우저의 순수 JavaScript가 `fetch`로 JSON API를 호출하고, Vercel Serverless Functions가 MongoDB Atlas를 읽고 쓴 뒤 JSON을 돌려준다. 화면은 서버가 아니라 브라우저의 JS가 그린다. 화면 하나당 HTML 1개 + JS 1개로 대응시켜 고칠 파일을 명확히 한다.

**Tech Stack:** HTML / CSS / JavaScript (ES Modules), Vercel Serverless Functions (Node.js), MongoDB Atlas, `mongodb`, `bcryptjs`

**설계 문서:** `docs/superpowers/specs/2026-07-28-board-crud-design.md`

---

## 이 계획의 검증 방식에 대하여

설계 문서에서 **자동화 테스트 대신 직접 확인하는 방식**을 택했다. 학습이 목적이므로 브라우저 개발자도구에서 요청·응답이 오가는 것을 눈으로 보는 편이 낫다고 판단했다.

따라서 각 태스크는 이 리듬을 따른다. 테스트 코드만 없을 뿐 순서는 TDD와 같다.

```
① 확인 방법을 먼저 정하고 실행한다  →  아직 안 되는 것을 눈으로 본다
② 최소한의 코드를 작성한다
③ 같은 방법으로 다시 확인한다      →  되는 것을 눈으로 본다
④ 커밋한다
```

**①을 건너뛰지 말 것.** "실패하는 것을 먼저 본다"가 이 리듬의 핵심이다. 이걸 건너뛰면 나중에 코드가 동작할 때 그게 정말 내 코드 덕분인지, 원래 되던 건지 구분할 수 없다.

---

## Global Constraints

프로젝트 전체에 적용된다. 모든 태스크의 요구사항에 이 항목들이 암묵적으로 포함된다.

- **Node.js 20.6 이상** — `node --env-file` 옵션을 쓴다. `node -v`로 확인할 것
- **`package.json`에 `"type": "module"`** — 없으면 `api/`, `lib/`의 `import`가 `Cannot use import statement outside a module`로 실패한다
- **모든 `<script>` 태그에 `type="module"`** — 없으면 `Unexpected token 'export'`로 실패한다
- **HTML 파일을 더블클릭으로 열지 말 것** — `type="module"`은 `file://`에서 동작하지 않는다. 항상 `vercel dev`가 띄운 `http://localhost:3000`으로 접속한다
- **의존성:** `mongodb@^6`, `bcryptjs@^2` (`bcrypt` 아님 — 네이티브 컴파일이 서버리스에서 실패할 수 있다)
- **에러 응답 형식:** 항상 `{ "error": "사용자에게 보여줄 한국어 메시지" }`
- **사용자 입력 표시는 항상 `textContent`** — `innerHTML`은 XSS를 만든다. 예외 없음
- **`passwordHash`는 어떤 API 응답에도 포함하지 않는다** — 모든 조회에 `projection`으로 제외
- **DB 접속 정보는 `process.env.MONGODB_URI`로만 읽는다** — 코드에 직접 쓰지 않는다. 레포가 public이다
- **브랜치:** `main`에서 직접 작업하고 커밋한다. 별도 작업 브랜치를 만들지 않는다
- **데이터베이스명 `board`, 컬렉션명 `posts`** — 전 구간 동일

---

## 파일 구조

각 파일의 책임을 먼저 정한다. 태스크 분할은 이 구조를 따른다.

| 파일 | 책임 |
|---|---|
| `package.json` | 의존성, `"type": "module"` 선언 |
| `.env.local` | `MONGODB_URI` (git 제외) |
| `lib/db.js` | MongoDB 연결을 캐시하고 `posts` 컬렉션을 돌려준다 |
| `lib/validate.js` | 입력값 검증 규칙 한 곳. 작성용·수정용 두 함수 |
| `api/posts/index.js` | `GET` 목록, `POST` 작성 |
| `api/posts/[id].js` | `GET` 상세, `PUT` 수정, `DELETE` 삭제 |
| `scripts/create-index.js` | 인덱스 생성 (한 번만 실행) |
| `scripts/seed.js` | 페이징 확인용 더미 글 15개 삽입 |
| `public/js/api.js` | 서버 호출을 모아둔 곳. 에러 처리도 여기서 통일 |
| `public/js/format.js` | 날짜 표시 형식 변환 |
| `public/js/list.js` | 목록 화면 로직 |
| `public/js/write.js` | 글쓰기 화면 로직 |
| `public/js/view.js` | 상세 화면 로직 (삭제 포함) |
| `public/js/edit.js` | 수정 화면 로직 |
| `public/index.html` | 목록 화면 |
| `public/write.html` | 글쓰기 화면 |
| `public/view.html` | 상세 화면 |
| `public/edit.html` | 수정 화면 |
| `public/css/style.css` | 공통 스타일 |

**설계 문서에서 추가된 파일 2개**와 그 이유:

- `lib/validate.js` — 검증 규칙이 작성(`POST`)과 수정(`PUT`) 양쪽에서 쓰인다. 한 곳에 두지 않으면 규칙이 갈라진다
- `public/js/format.js` — 날짜 형식 변환이 목록과 상세 양쪽에서 쓰인다

---

## 태스크 순서

각 태스크는 **눈에 보이는 결과**로 끝난다.

| # | 태스크 | 끝나면 보이는 것 |
|---|---|---|
| 1 | 프로젝트 뼈대 | 브라우저에 페이지가 뜬다 |
| 2 | MongoDB 연결 | DB 연결 성공이 화면에 뜬다 |
| 3 | 목록 조회 API | 주소창에 JSON이 뜬다 |
| 4 | 목록 화면 | "등록된 글이 없습니다"가 뜬다 |
| 5 | 글 작성 API | curl로 글이 저장된다 |
| 6 | 글쓰기 화면 | 글을 쓰면 목록에 나타난다 |
| 7 | 상세 조회 API | JSON에 본문이 온다, 조회수가 오른다 |
| 8 | 상세 화면 | 글을 클릭하면 내용이 보인다 |
| 9 | 수정 API | curl로 글이 수정된다 |
| 10 | 수정 화면 | 화면에서 글을 고칠 수 있다 |
| 11 | 삭제 | 화면에서 글을 지울 수 있다 |
| 12 | CSS + 전체 검증 | 게시판처럼 보이고, 15개 시나리오가 통과한다 |
| 13 | 배포 | 인터넷 주소로 접속된다 |

---

# Task 1: 프로젝트 뼈대와 로컬 서버

**Files:**
- Create: `package.json`
- Create: `.env.local`
- Create: `api/hello.js` (임시 — Task 3에서 삭제)
- Create: `public/index.html`
- Create: `public/css/style.css`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `vercel dev`로 `http://localhost:3000` 접속 가능한 상태. `api/` 폴더가 서버리스 함수로 인식되는 것을 확인한 상태

---

- [ ] **Step 1: Node.js 버전 확인**

Run:
```bash
node -v
```
Expected: `v20.6.0` 이상. 낮으면 https://nodejs.org 에서 LTS 버전 설치 후 다시 확인.

---

- [ ] **Step 2: Vercel CLI 설치와 로그인**

Run:
```bash
npm install -g vercel
vercel login
```
Expected: 브라우저가 열리고 로그인 후 `> Success! GitHub authentication complete`

---

- [ ] **Step 3: 확인 먼저 — 아직 아무것도 안 뜨는 것을 본다**

Run:
```bash
vercel dev
```
Expected: **실패한다.** `Error: No package.json` 또는 프로젝트 설정을 묻는 프롬프트가 뜬다. 뜨는 프롬프트는 `Ctrl+C`로 취소.

이 단계는 "아직 준비가 안 됐다"를 눈으로 확인하는 것이 목적이다.

---

- [ ] **Step 4: `package.json` 작성**

`package.json`:
```json
{
  "name": "bulletin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "게시판 CRUD 학습 프로젝트",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "mongodb": "^6.3.0"
  }
}
```

`"type": "module"`이 핵심이다. 이게 없으면 `api/`와 `lib/`에서 `import`를 쓸 수 없다.

---

- [ ] **Step 5: 의존성 설치**

Run:
```bash
npm install
```
Expected: `node_modules/` 폴더와 `package-lock.json`이 생긴다. `added NN packages` 메시지.

---

- [ ] **Step 6: `.env.local` 자리 만들기**

`.env.local`:
```bash
# MongoDB Atlas 접속 문자열. Task 2에서 실제 값으로 채운다.
# 이 파일은 .gitignore에 있어 git에 올라가지 않는다.
MONGODB_URI=
```

---

- [ ] **Step 7: 서버리스 함수가 동작하는지 확인할 임시 API 작성**

`api/hello.js`:
```js
// Task 3에서 삭제할 임시 파일.
// api/ 폴더에 파일을 두면 Vercel이 자동으로 API 주소를 만들어준다는 것을
// 확인하기 위한 용도다. 이 파일은 /api/hello 주소가 된다.
export default function handler(req, res) {
  res.status(200).json({
    message: '서버리스 함수가 동작합니다',
    method: req.method,
  });
}
```

---

- [ ] **Step 8: 목록 화면의 껍데기 작성**

`public/index.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>자유게시판</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="container">
    <h1>자유게시판</h1>
    <p>준비 중입니다.</p>
  </main>
</body>
</html>
```

---

- [ ] **Step 9: 기본 스타일 작성**

`public/css/style.css`:
```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #222;
  background: #fafafa;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}

h1 {
  font-size: 24px;
  margin: 0;
}
```

---

- [ ] **Step 10: 다시 확인 — 이번엔 뜬다**

Run:
```bash
vercel dev
```

프롬프트가 뜨면 이렇게 답한다:
- `Set up and develop ...?` → `y`
- `Which scope?` → 본인 계정 선택
- `Link to existing project?` → `n`
- `What's your project's name?` → `bulletin` (엔터)
- `In which directory is your code located?` → `./` (엔터)

Expected: `> Ready! Available at http://localhost:3000`

브라우저에서 확인:

| 주소 | 보여야 하는 것 |
|---|---|
| `http://localhost:3000` | "자유게시판 / 준비 중입니다." |
| `http://localhost:3000/api/hello` | `{"message":"서버리스 함수가 동작합니다","method":"GET"}` |

**둘 다 확인되어야 다음으로 넘어간다.** 정적 파일과 서버리스 함수가 모두 동작한다는 뜻이다.

**문제 해결:** `http://localhost:3000`이 404라면 Vercel이 `public/`을 출력 폴더로 잡지 못한 것이다. `Ctrl+C`로 끄고 프로젝트 루트에 `vercel.json`을 만든다:
```json
{
  "outputDirectory": "public"
}
```
그 후 `vercel dev`를 다시 실행한다.

---

- [ ] **Step 11: `.gitignore`에 `.vercel` 포함 여부 확인**

Run:
```bash
git check-ignore -v .vercel .env.local node_modules
```
Expected: 세 줄 모두 `.gitignore` 규칙과 함께 출력된다. 출력이 없는 항목이 있으면 `.gitignore`에 추가한다.

---

- [ ] **Step 12: 커밋**

```bash
git add package.json package-lock.json api/hello.js public/index.html public/css/style.css
git commit -m "feat: 프로젝트 뼈대와 로컬 개발 서버 설정"
git push
```

`.env.local`은 `git add`에 넣지 않는다. 실수로 넣어도 `.gitignore`가 막지만, 습관을 들인다.

---

# Task 2: MongoDB Atlas 연결

**Files:**
- Create: `lib/db.js`
- Create: `scripts/create-index.js`
- Modify: `api/hello.js` (DB 연결 확인 추가)
- Modify: `.env.local` (실제 접속 문자열 입력)

**Interfaces:**
- Consumes: Task 1의 `vercel dev` 환경, `package.json`의 `mongodb` 의존성
- Produces: `lib/db.js`가 `export async function getPostsCollection()`를 제공한다. 반환값은 `board` 데이터베이스의 `posts` 컬렉션 객체이며, 이후 모든 API가 이 함수만 호출한다

---

- [ ] **Step 1: MongoDB Atlas 클러스터 생성**

1. https://www.mongodb.com/cloud/atlas/register 에서 가입
2. **Create a cluster** → **M0 FREE** 선택 → Provider/Region은 기본값 → **Create Deployment**
3. **Database Access** → **Add New Database User**
   - Authentication Method: Password
   - Username: `boarduser`
   - Password: **Autogenerate Secure Password**로 생성하고 복사해 둔다
   - Database User Privileges: **Read and write to any database**
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)

`0.0.0.0/0`을 여는 이유: Vercel 서버리스 함수는 IP가 고정되지 않아 특정 IP만 허용할 수 없다. 대신 위에서 생성한 긴 비밀번호가 방어선이다.

---

- [ ] **Step 2: 접속 문자열을 `.env.local`에 입력**

Atlas 화면에서 **Connect** → **Drivers** → **Node.js**를 선택하면 접속 문자열이 나온다.

`.env.local`:
```bash
MONGODB_URI=mongodb+srv://boarduser:여기에실제비밀번호@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

주의:
- 접속 문자열의 `<password>` 부분을 **실제 비밀번호로 바꾼다.** 꺾쇠괄호도 지운다
- 비밀번호에 특수문자가 있으면 URL 인코딩이 필요하다. 번거로우니 **영문+숫자로만 된 비밀번호**를 쓰는 편이 낫다
- 이 파일은 절대 `git add` 하지 않는다

---

- [ ] **Step 3: 확인 먼저 — 접속 정보가 맞는지 본다**

Run:
```bash
node --env-file=.env.local -e "import('mongodb').then(async (m) => { const c = await new m.MongoClient(process.env.MONGODB_URI).connect(); console.log('연결 성공'); await c.close(); })"
```

Expected: `연결 성공`

여기서 실패하면 **아직 코드 문제가 아니라 접속 정보 문제**다.

| 에러 메시지 | 원인 |
|---|---|
| `bad auth : authentication failed` | 비밀번호가 틀렸거나 `<password>`를 안 바꿨다 |
| `Could not connect to any servers` | Network Access에 `0.0.0.0/0`이 없다 |
| `Invalid scheme` | `MONGODB_URI` 값이 비어 있다 |

**이 단계가 통과해야 다음으로 넘어간다.** 여기서 막히면 이후 모든 태스크가 막힌다.

---

- [ ] **Step 4: `lib/db.js` 작성**

`lib/db.js`:
```js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다. .env.local 파일을 확인하세요.');
}

// 연결을 전역에 캐시한다.
//
// 서버리스 함수는 요청이 올 때만 깨어나지만, 한 번 깨어난 인스턴스는
// 잠시 살아있다가 다음 요청에 재사용된다. 이때 모듈 스코프 변수도 살아있다.
// 매 요청마다 새로 연결하면 MongoDB Atlas 무료 티어의 연결 한도(500개)를
// 금방 넘겨 "connection limit exceeded"로 터진다.
//
// globalThis에 담는 이유는 vercel dev가 모듈을 다시 불러올 때도
// 연결이 중복 생성되지 않게 하기 위함이다.
let clientPromise = globalThis._mongoClientPromise;

if (!clientPromise) {
  clientPromise = new MongoClient(uri).connect();
  globalThis._mongoClientPromise = clientPromise;
}

/**
 * board 데이터베이스의 posts 컬렉션을 돌려준다.
 * 모든 API 함수는 DB에 직접 접근하지 않고 이 함수만 호출한다.
 */
export async function getPostsCollection() {
  const client = await clientPromise;
  return client.db('board').collection('posts');
}
```

---

- [ ] **Step 5: `api/hello.js`가 DB까지 확인하도록 수정**

`api/hello.js` (전체를 아래로 교체):
```js
// Task 3에서 삭제할 임시 파일.
// 서버리스 함수와 MongoDB 연결이 모두 동작하는지 확인하는 용도다.
import { getPostsCollection } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const col = await getPostsCollection();
    const count = await col.countDocuments();

    res.status(200).json({
      message: '서버리스 함수와 DB 연결이 모두 동작합니다',
      postCount: count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}
```

`import` 경로가 `'../lib/db.js'`인 점에 주의한다. **`.js` 확장자를 반드시 붙인다.** ES 모듈에서는 확장자 생략이 안 된다.

---

- [ ] **Step 6: 다시 확인 — DB 연결이 되는 것을 본다**

`.env.local`을 만든 뒤라면 `vercel dev`를 한 번 껐다 켠다.

Run:
```bash
vercel dev
```

브라우저에서 `http://localhost:3000/api/hello` 접속.

Expected:
```json
{"message":"서버리스 함수와 DB 연결이 모두 동작합니다","postCount":0}
```

`postCount`가 `0`인 것이 정상이다. 아직 글이 하나도 없다.

---

- [ ] **Step 7: 인덱스 생성 스크립트 작성**

`scripts/create-index.js`:
```js
// 한 번만 실행하면 되는 스크립트.
// 목록 조회는 항상 createdAt 내림차순으로 정렬한다.
// 인덱스가 없으면 글이 많아졌을 때 DB가 전체를 훑어가며 정렬해야 해서 느려진다.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다.');
}

const client = await new MongoClient(uri).connect();

try {
  const name = await client
    .db('board')
    .collection('posts')
    .createIndex({ createdAt: -1 });

  console.log('인덱스 생성 완료:', name);
} finally {
  await client.close();
}
```

---

- [ ] **Step 8: 인덱스 생성 실행**

Run:
```bash
node --env-file=.env.local scripts/create-index.js
```
Expected: `인덱스 생성 완료: createdAt_-1`

같은 명령을 다시 실행해도 안전하다. `createIndex`는 이미 있으면 아무것도 하지 않는다.

---

- [ ] **Step 9: 커밋**

```bash
git add lib/db.js scripts/create-index.js api/hello.js
git commit -m "feat: MongoDB Atlas 연결과 인덱스 생성"
git push
```

---

# Task 3: 목록 조회 API

**Files:**
- Create: `api/posts/index.js`
- Delete: `api/hello.js`

**Interfaces:**
- Consumes: `lib/db.js`의 `getPostsCollection()`
- Produces: `GET /api/posts?page=N` 이 아래 형태의 JSON을 돌려준다. Task 4의 `public/js/api.js`가 이 형태에 의존한다

```
{ posts: Array<{_id, title, author, views, createdAt}>,
  currentPage: number, totalPages: number, totalCount: number }
```

`posts` 배열의 각 항목에는 `content`와 `passwordHash`가 **없다**

---

- [ ] **Step 1: 확인 먼저 — 아직 없는 주소인 것을 본다**

브라우저에서 `http://localhost:3000/api/posts` 접속.

Expected: **404 페이지.** 아직 그 주소를 처리할 파일이 없다.

---

- [ ] **Step 2: 목록 조회 API 작성**

`api/posts/index.js`:
```js
import { getPostsCollection } from '../../lib/db.js';

const PER_PAGE = 10;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await listPosts(req, res);
    }
    return res.status(405).json({ error: '허용되지 않는 방식입니다' });
  } catch (err) {
    // 상세 내용은 서버 로그에만 남긴다.
    // 사용자에게 그대로 보내면 DB 접속 정보 같은 내부 정보가 노출될 수 있다.
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function listPosts(req, res) {
  // page가 없거나 숫자가 아니거나 0 이하이면 1로 본다.
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * PER_PAGE;

  const col = await getPostsCollection();

  const totalCount = await col.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const posts = await col
    // projection: 목록에는 본문이 필요 없다. 5000자짜리 본문 10개를
    // 쓸데없이 실어 나르지 않는다. passwordHash는 절대 내보내지 않는다.
    .find({}, { projection: { content: 0, passwordHash: 0 } })
    .sort({ createdAt: -1 })  // 최신 글이 위로
    .skip(skip)               // 앞의 N개는 건너뛰고
    .limit(PER_PAGE)          // 10개만 가져온다
    .toArray();

  return res.status(200).json({ posts, currentPage: page, totalPages, totalCount });
}
```

---

- [ ] **Step 3: 다시 확인 — JSON이 뜬다**

브라우저에서 아래 두 주소를 확인한다.

| 주소 | 기대 응답 |
|---|---|
| `http://localhost:3000/api/posts` | `{"posts":[],"currentPage":1,"totalPages":1,"totalCount":0}` |
| `http://localhost:3000/api/posts?page=3` | `{"posts":[],"currentPage":3,"totalPages":1,"totalCount":0}` |

`posts`가 빈 배열인 것이 정상이다. 아직 글이 없다. **빈 배열은 에러가 아니다** — "찾아봤는데 없다"는 정상 응답이다.

---

- [ ] **Step 4: 잘못된 메서드 거부 확인**

Run:
```bash
curl -i -X DELETE http://localhost:3000/api/posts
```
Expected: 첫 줄이 `HTTP/1.1 405`, 본문이 `{"error":"허용되지 않는 방식입니다"}`

---

- [ ] **Step 5: 임시 파일 삭제**

Run:
```bash
rm api/hello.js
```

역할이 끝났다. 서버리스 함수와 DB 연결이 동작한다는 것은 이제 `/api/posts`가 증명한다.

---

- [ ] **Step 6: 삭제 확인**

브라우저에서 `http://localhost:3000/api/hello` 접속.

Expected: 404. `http://localhost:3000/api/posts`는 여전히 정상 응답.

---

- [ ] **Step 7: 커밋**

```bash
git add api/posts/index.js
git rm api/hello.js
git commit -m "feat: 글 목록 조회 API"
git push
```

---

# Task 4: 목록 화면

**Files:**
- Create: `public/js/api.js`
- Create: `public/js/format.js`
- Create: `public/js/list.js`
- Modify: `public/index.html` (전체 교체)
- Modify: `public/css/style.css` (표·버튼 스타일 추가)

**Interfaces:**
- Consumes: `GET /api/posts?page=N` (Task 3)
- Produces:
  - `public/js/api.js` — `getPosts(page)`, `getPost(id, countView)`, `createPost(data)`, `updatePost(id, data)`, `deletePost(id, password)`. 모두 실패 시 `Error`를 던지며 `err.message`는 사용자에게 그대로 보여줄 한국어 문장이다
  - `public/js/format.js` — `formatDateShort(iso)` → `"07-28"`, `formatDateFull(iso)` → `"2026-07-28 14:30"`

---

- [ ] **Step 1: 확인 먼저 — 아직 "준비 중입니다"만 뜨는 것을 본다**

브라우저에서 `http://localhost:3000` 접속.

Expected: "자유게시판 / 준비 중입니다." 표도 없고 서버 호출도 없다.

개발자도구(F12) → Network 탭을 열어두고 새로고침한다. `/api/posts` 요청이 **없는** 것을 확인한다.

---

- [ ] **Step 2: `public/js/api.js` 작성**

`public/js/api.js`:
```js
// 서버와 대화하는 일을 전부 여기 모은다.
// 화면 쪽 JS는 이 함수들만 부르고, fetch를 직접 쓰지 않는다.
// 나중에 API 주소가 바뀌어도 이 파일만 고치면 된다.

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * 모든 요청이 거쳐 가는 공통 함수.
 * 실패하면 사용자에게 보여줄 메시지를 담아 Error를 던진다.
 */
async function request(url, options = {}) {
  let res;

  try {
    res = await fetch(url, options);
  } catch {
    // 인터넷이 끊겼거나 서버가 응답하지 않는 경우.
    throw new Error('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
  }

  // 204 No Content — 삭제 성공. 돌려줄 본문이 없다.
  if (res.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // 서버가 { error: "..." } 형태로 보낸 메시지를 그대로 쓴다.
    throw new Error(data?.error || '요청을 처리하지 못했습니다');
  }

  return data;
}

export function getPosts(page = 1) {
  return request('/api/posts?page=' + page);
}

export function getPost(id, countView = false) {
  // countView가 true일 때만 조회수가 오른다.
  // 수정 화면에서 글을 불러올 때는 조회수가 오르면 안 된다.
  const query = countView ? '?countView=1' : '';
  return request('/api/posts/' + id + query);
}

export function createPost(data) {
  return request('/api/posts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
}

export function updatePost(id, data) {
  return request('/api/posts/' + id, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
}

export function deletePost(id, password) {
  return request('/api/posts/' + id, {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ password }),
  });
}
```

`getPost`부터 `deletePost`까지는 Task 7 이후에야 서버 쪽이 준비된다. 지금 미리 써두는 이유는, 이 파일이 "서버와 대화하는 창구" 하나로 완결되어야 이후 태스크에서 화면 코드에만 집중할 수 있기 때문이다.

---

- [ ] **Step 3: `public/js/format.js` 작성**

`public/js/format.js`:
```js
// 서버는 날짜를 ISO 문자열("2026-07-28T05:30:00.000Z")로 보낸다.
// 사람이 읽기 좋은 형태로 바꾼다.

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 목록용: "07-28" */
export function formatDateShort(iso) {
  const d = new Date(iso);
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** 상세용: "2026-07-28 14:30" */
export function formatDateFull(iso) {
  const d = new Date(iso);
  const date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
  return date + ' ' + time;
}
```

`getMonth()`는 0부터 시작한다. 7월이 `6`으로 나오므로 `+1`이 필요하다. 흔한 실수다.

---

- [ ] **Step 4: `public/index.html` 교체**

`public/index.html` (전체를 아래로 교체):
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>자유게시판</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="container">
    <header class="page-header">
      <h1>자유게시판</h1>
      <a class="btn btn-primary" href="write.html">글쓰기</a>
    </header>

    <table class="board">
      <thead>
        <tr>
          <th class="col-no">번호</th>
          <th class="col-title">제목</th>
          <th class="col-author">작성자</th>
          <th class="col-date">날짜</th>
          <th class="col-views">조회</th>
        </tr>
      </thead>
      <tbody id="post-list"></tbody>
    </table>

    <p id="status" class="status">불러오는 중...</p>
    <nav id="pagination" class="pagination"></nav>
  </main>

  <script type="module" src="js/list.js"></script>
</body>
</html>
```

`type="module"`이 없으면 `list.js`의 `import`가 `Unexpected token 'import'`로 실패한다.

---

- [ ] **Step 5: `public/js/list.js` 작성**

`public/js/list.js`:
```js
import { getPosts } from './api.js';
import { formatDateShort } from './format.js';

const PER_PAGE = 10;

const listEl = document.getElementById('post-list');
const statusEl = document.getElementById('status');
const pagerEl = document.getElementById('pagination');

// 주소창의 ?page=3 을 읽는다. 없으면 1페이지.
const page = Math.max(
  1,
  parseInt(new URLSearchParams(location.search).get('page'), 10) || 1
);

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

function renderRows(posts, totalCount, currentPage) {
  // 화면에 보이는 번호는 _id가 아니라 "몇 번째 글인가"다.
  // 최신 글이 가장 큰 번호를 갖는다.
  const firstNumber = totalCount - (currentPage - 1) * PER_PAGE;

  posts.forEach((post, index) => {
    const tr = document.createElement('tr');

    const no = document.createElement('td');
    no.textContent = firstNumber - index;

    const title = document.createElement('td');
    title.className = 'col-title';
    const link = document.createElement('a');
    link.href = 'view.html?id=' + post._id;
    // textContent를 쓴다. innerHTML을 쓰면 제목에 넣은 <script>가 실행된다.
    link.textContent = post.title;
    title.appendChild(link);

    const author = document.createElement('td');
    author.textContent = post.author;

    const date = document.createElement('td');
    date.textContent = formatDateShort(post.createdAt);

    const views = document.createElement('td');
    views.textContent = post.views;

    tr.append(no, title, author, date, views);
    listEl.appendChild(tr);
  });
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i += 1) {
    if (i === currentPage) {
      const span = document.createElement('span');
      span.className = 'page current';
      span.textContent = i;
      pagerEl.appendChild(span);
    } else {
      const a = document.createElement('a');
      a.className = 'page';
      a.href = 'index.html?page=' + i;
      a.textContent = i;
      pagerEl.appendChild(a);
    }
  }
}

async function load() {
  try {
    const data = await getPosts(page);

    if (data.posts.length === 0) {
      showStatus('등록된 글이 없습니다');
      return;
    }

    hideStatus();
    renderRows(data.posts, data.totalCount, data.currentPage);
    renderPagination(data.currentPage, data.totalPages);
  } catch (err) {
    showStatus(err.message);
  }
}

load();
```

---

- [ ] **Step 6: 목록 화면 스타일 추가**

`public/css/style.css` 끝에 아래를 덧붙인다:
```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.btn {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #222;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}

.btn:hover {
  background: #f0f0f0;
}

.btn-primary {
  background: #2b6cb0;
  border-color: #2b6cb0;
  color: #fff;
}

.btn-primary:hover {
  background: #245a94;
}

.board {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-top: 2px solid #444;
}

.board th,
.board td {
  padding: 12px 8px;
  border-bottom: 1px solid #e5e5e5;
  text-align: center;
  font-size: 14px;
}

.board th {
  background: #f7f7f7;
  font-weight: 600;
}

.board .col-title {
  text-align: left;
}

.board .col-no     { width: 70px; }
.board .col-author { width: 110px; }
.board .col-date   { width: 90px; }
.board .col-views  { width: 70px; }

.board a {
  color: #222;
  text-decoration: none;
}

.board a:hover {
  text-decoration: underline;
}

.status {
  padding: 40px 0;
  text-align: center;
  color: #888;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 24px;
}

.page {
  min-width: 32px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  color: #444;
  text-align: center;
  text-decoration: none;
}

.page.current {
  background: #2b6cb0;
  border-color: #2b6cb0;
  color: #fff;
}
```

---

- [ ] **Step 7: 다시 확인 — 표와 "등록된 글이 없습니다"가 뜬다**

브라우저에서 `http://localhost:3000` 접속. 개발자도구 Network 탭을 켠 상태로.

Expected:
- 표 머리(번호/제목/작성자/날짜/조회)가 보인다
- 그 아래 **"등록된 글이 없습니다"**
- 오른쪽 위에 **[글쓰기]** 버튼 (누르면 404 — `write.html`은 Task 6에서 만든다)
- Network 탭에 **`posts?page=1` 요청이 `200`으로 찍힌다**
- Console 탭에 빨간 에러가 없다

**Network 탭의 요청을 클릭해 Response를 열어본다.** 서버가 보낸 JSON 원본이 보인다. 이 JSON이 위의 표로 바뀌는 것이 이 프로젝트의 핵심 흐름이다.

---

- [ ] **Step 8: 에러 처리 확인**

`vercel dev`를 `Ctrl+C`로 끈 뒤, 브라우저를 새로고침한다.

Expected: **"네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요"**

확인 후 `vercel dev`를 다시 켠다.

---

- [ ] **Step 9: 커밋**

```bash
git add public/js/api.js public/js/format.js public/js/list.js public/index.html public/css/style.css
git commit -m "feat: 글 목록 화면"
git push
```

---

# Task 5: 글 작성 API

**Files:**
- Create: `lib/validate.js`
- Modify: `api/posts/index.js` (`POST` 처리 추가)

**Interfaces:**
- Consumes: `lib/db.js`의 `getPostsCollection()`
- Produces:
  - `lib/validate.js` — `validateCreate(body)`와 `validateUpdate(body)`. 둘 다 실패 시 `{ error: string }`, 성공 시 `{ value: {...} }`를 돌려준다. `validateCreate`의 `value`는 `{title, content, author, password}`, `validateUpdate`의 `value`는 `{title, content, password}` (모두 `trim()` 적용됨)
  - `POST /api/posts` — 성공 시 `201`과 `{ _id: string }`

---

- [ ] **Step 1: 확인 먼저 — 아직 POST가 거부되는 것을 본다**

Run:
```bash
curl -i -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title":"첫 글","content":"내용입니다","author":"홍길동","password":"1234"}'
```

Expected: `HTTP/1.1 405`, 본문 `{"error":"허용되지 않는 방식입니다"}`

`GET`만 처리하도록 만들어 뒀으니 당연한 결과다.

---

- [ ] **Step 2: `lib/validate.js` 작성**

`lib/validate.js`:
```js
// 입력값 검증 규칙을 한 곳에 모은다.
// 작성(POST)과 수정(PUT) 양쪽에서 쓰이므로, 여기 두지 않으면 규칙이 갈라진다.
//
// 이 검증이 "진짜" 방어선이다.
// 브라우저 쪽 검증은 개발자도구로 얼마든지 우회할 수 있다.

const LIMITS = {
  title: 100,
  content: 5000,
  author: 20,
  passwordMin: 4,
};

/** 문자열이 아니면 빈 문자열로, 맞으면 앞뒤 공백을 제거해서 돌려준다. */
function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 제목과 내용은 작성·수정 양쪽에서 규칙이 같다. */
function checkTitleAndContent(title, content) {
  if (!title) return '제목을 입력해주세요';
  if (title.length > LIMITS.title) return '제목은 ' + LIMITS.title + '자 이내로 입력해주세요';
  if (!content) return '내용을 입력해주세요';
  if (content.length > LIMITS.content) return '내용은 ' + LIMITS.content + '자 이내로 입력해주세요';
  return null;
}

export function validateCreate(body = {}) {
  const title = asText(body.title);
  const content = asText(body.content);
  const author = asText(body.author);
  // 비밀번호는 trim하지 않는다. 공백도 비밀번호의 일부일 수 있다.
  const password = typeof body.password === 'string' ? body.password : '';

  const textError = checkTitleAndContent(title, content);
  if (textError) return { error: textError };

  if (!author) return { error: '작성자를 입력해주세요' };
  if (author.length > LIMITS.author) {
    return { error: '작성자는 ' + LIMITS.author + '자 이내로 입력해주세요' };
  }
  if (password.length < LIMITS.passwordMin) {
    return { error: '비밀번호는 ' + LIMITS.passwordMin + '자 이상이어야 합니다' };
  }

  return { value: { title, content, author, password } };
}

export function validateUpdate(body = {}) {
  const title = asText(body.title);
  const content = asText(body.content);
  const password = typeof body.password === 'string' ? body.password : '';

  const textError = checkTitleAndContent(title, content);
  if (textError) return { error: textError };

  if (!password) return { error: '비밀번호를 입력해주세요' };

  return { value: { title, content, password } };
}
```

---

- [ ] **Step 3: `api/posts/index.js`에 `POST` 처리 추가**

`api/posts/index.js` (전체를 아래로 교체):
```js
import bcrypt from 'bcryptjs';
import { getPostsCollection } from '../../lib/db.js';
import { validateCreate } from '../../lib/validate.js';

const PER_PAGE = 10;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await listPosts(req, res);
    }
    if (req.method === 'POST') {
      return await createPost(req, res);
    }
    return res.status(405).json({ error: '허용되지 않는 방식입니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function listPosts(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * PER_PAGE;

  const col = await getPostsCollection();

  const totalCount = await col.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const posts = await col
    .find({}, { projection: { content: 0, passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(PER_PAGE)
    .toArray();

  return res.status(200).json({ posts, currentPage: page, totalPages, totalCount });
}

async function createPost(req, res) {
  const { error, value } = validateCreate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const col = await getPostsCollection();

  // 비밀번호는 해시해서 저장한다. 원문은 어디에도 남기지 않는다.
  // 10은 해시 강도다. 숫자가 클수록 안전하지만 느려진다.
  const passwordHash = await bcrypt.hash(value.password, 10);

  const result = await col.insertOne({
    title: value.title,
    content: value.content,
    author: value.author,
    passwordHash,
    views: 0,
    createdAt: new Date(),
  });

  // 브라우저가 곧바로 상세 페이지로 이동할 수 있게 _id를 돌려준다.
  return res.status(201).json({ _id: result.insertedId });
}
```

---

- [ ] **Step 4: 다시 확인 — 글이 저장된다**

Run:
```bash
curl -i -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title":"첫 글","content":"내용입니다","author":"홍길동","password":"1234"}'
```

Expected: `HTTP/1.1 201`, 본문 `{"_id":"68..."}`

---

- [ ] **Step 5: 목록에 반영되는지 확인**

브라우저에서 `http://localhost:3000` 접속.

Expected: "등록된 글이 없습니다"가 사라지고 **"첫 글 / 홍길동 / 오늘 날짜 / 0"** 한 줄이 표에 보인다.

**화면 코드는 하나도 안 고쳤는데 내용이 바뀌었다.** 데이터와 화면이 분리되어 있다는 뜻이다.

---

- [ ] **Step 6: 검증이 동작하는지 확인**

각각 실행하고 응답을 확인한다.

```bash
curl -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title":"","content":"내용","author":"홍길동","password":"1234"}'
```
Expected: `{"error":"제목을 입력해주세요"}`

```bash
curl -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title":"   ","content":"내용","author":"홍길동","password":"1234"}'
```
Expected: `{"error":"제목을 입력해주세요"}` — 공백만 넣어도 거부된다(`trim()` 동작 확인)

```bash
curl -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title":"제목","content":"내용","author":"홍길동","password":"12"}'
```
Expected: `{"error":"비밀번호는 4자 이상이어야 합니다"}`

---

- [ ] **Step 7: 비밀번호가 해시되어 저장됐는지 확인**

Run:
```bash
node --env-file=.env.local -e "import('mongodb').then(async (m) => { const c = await new m.MongoClient(process.env.MONGODB_URI).connect(); const d = await c.db('board').collection('posts').findOne({}); console.log('passwordHash:', d.passwordHash); await c.close(); })"
```

Expected: `$2a$10$...` 로 시작하는 60자 문자열. **`1234`가 그대로 보이면 안 된다.**

---

- [ ] **Step 8: 커밋**

```bash
git add lib/validate.js api/posts/index.js
git commit -m "feat: 글 작성 API"
git push
```

---

# Task 6: 글쓰기 화면

**Files:**
- Create: `public/write.html`
- Create: `public/js/write.js`
- Modify: `public/css/style.css` (폼 스타일 추가)

**Interfaces:**
- Consumes: `public/js/api.js`의 `createPost(data)`
- Produces: `write.html` 화면. 저장 성공 시 `view.html?id=<새_id>`로 이동한다 (그 화면은 Task 8에서 만든다)

---

- [ ] **Step 1: 확인 먼저 — [글쓰기] 버튼이 404인 것을 본다**

브라우저에서 `http://localhost:3000` 접속 후 **[글쓰기]** 클릭.

Expected: 404 페이지.

---

- [ ] **Step 2: `public/write.html` 작성**

`public/write.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>글쓰기 - 자유게시판</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="container">
    <header class="page-header">
      <h1>글쓰기</h1>
    </header>

    <form id="post-form" class="form" novalidate>
      <div class="field">
        <label for="title">제목</label>
        <input type="text" id="title" maxlength="100" autocomplete="off">
      </div>

      <div class="field">
        <label for="author">작성자</label>
        <input type="text" id="author" maxlength="20" autocomplete="off">
      </div>

      <div class="field">
        <label for="password">비밀번호</label>
        <input type="password" id="password" autocomplete="new-password">
        <p class="hint">수정·삭제할 때 필요합니다. 4자 이상.</p>
      </div>

      <div class="field">
        <label for="content">내용</label>
        <textarea id="content" rows="12" maxlength="5000"></textarea>
      </div>

      <p id="error" class="error" hidden></p>

      <div class="form-actions">
        <a class="btn" href="index.html">취소</a>
        <button type="submit" id="submit" class="btn btn-primary">등록</button>
      </div>
    </form>
  </main>

  <script type="module" src="js/write.js"></script>
</body>
</html>
```

`novalidate`를 붙인 이유: 브라우저 기본 검증 메시지 대신 우리가 만든 메시지를 쓰기 위해서다.

---

- [ ] **Step 3: `public/js/write.js` 작성**

`public/js/write.js`:
```js
import { createPost } from './api.js';

const form = document.getElementById('post-form');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
}

/**
 * 브라우저 쪽 검증.
 * 서버에 갔다 오지 않고 바로 알려주기 위한 편의 기능이다.
 * 개발자도구로 우회할 수 있으므로 이것만 믿으면 안 된다.
 * 진짜 방어는 서버의 lib/validate.js가 한다.
 */
function validate(data) {
  if (!data.title.trim()) return '제목을 입력해주세요';
  if (!data.author.trim()) return '작성자를 입력해주세요';
  if (data.password.length < 4) return '비밀번호는 4자 이상이어야 합니다';
  if (!data.content.trim()) return '내용을 입력해주세요';
  return null;
}

form.addEventListener('submit', async (event) => {
  // form의 기본 동작(페이지 새로고침)을 막는다.
  // 이걸 빼먹으면 fetch가 실행되기도 전에 페이지가 다시 로드된다.
  event.preventDefault();
  clearError();

  const data = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    password: document.getElementById('password').value,
    content: document.getElementById('content').value,
  };

  const localError = validate(data);
  if (localError) {
    showError(localError);
    return;
  }

  // 두 번 눌러서 글이 두 개 올라가는 것을 막는다.
  submitBtn.disabled = true;
  submitBtn.textContent = '등록 중...';

  try {
    const created = await createPost(data);
    location.href = 'view.html?id=' + created._id;
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '등록';
  }
});
```

---

- [ ] **Step 4: 폼 스타일 추가**

`public/css/style.css` 끝에 아래를 덧붙인다:
```css
.form {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 24px;
}

.field {
  margin-bottom: 18px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
}

.field input,
.field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 15px;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: #2b6cb0;
}

.field textarea {
  resize: vertical;
}

.hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: #888;
}

.error {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 4px;
  background: #fdecec;
  color: #c0392b;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.readonly-value {
  padding: 10px 0;
  color: #555;
}
```

---

- [ ] **Step 5: 다시 확인 — 글이 써진다**

브라우저에서 `http://localhost:3000` → **[글쓰기]** 클릭.

Expected: 글쓰기 폼이 보인다.

제목 `두 번째 글`, 작성자 `김철수`, 비밀번호 `1234`, 내용에 아무 글이나 입력하고 **[등록]**.

Expected: `view.html?id=...` 주소로 이동한다. **404가 뜨는 것이 정상이다** — 상세 화면은 Task 8에서 만든다. 주소창의 `id=` 뒤에 긴 문자열이 붙어 있으면 성공한 것이다.

---

- [ ] **Step 6: 목록에서 확인**

브라우저에서 `http://localhost:3000` 접속.

Expected: **"두 번째 글 / 김철수"**가 맨 위에, 그 아래 "첫 글 / 홍길동". 최신순 정렬이 동작한다.

---

- [ ] **Step 7: 브라우저 검증 확인**

[글쓰기]에서 아무것도 입력하지 않고 **[등록]**.

Expected: **"제목을 입력해주세요"**가 빨간 박스로 뜬다. Network 탭에 요청이 **가지 않는다**(서버까지 안 갔다).

---

- [ ] **Step 8: 브라우저 검증을 우회해도 서버가 막는지 확인**

이게 이 태스크에서 가장 중요한 확인이다.

Run:
```bash
LONG=$(printf 'A%.0s' {1..200})
curl -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d "{\"title\":\"$LONG\",\"content\":\"내용\",\"author\":\"홍길동\",\"password\":\"1234\"}"
```

Expected: `{"error":"제목은 100자 이내로 입력해주세요"}`

화면의 `maxlength="100"`을 완전히 건너뛰고 200자를 보냈는데도 서버가 거부했다. **브라우저 검증은 못 믿는다**는 것을 눈으로 확인하는 단계다.

---

- [ ] **Step 9: 커밋**

```bash
git add public/write.html public/js/write.js public/css/style.css
git commit -m "feat: 글쓰기 화면"
git push
```

---

# Task 7: 상세 조회 API

**Files:**
- Create: `api/posts/[id].js`

**Interfaces:**
- Consumes: `lib/db.js`의 `getPostsCollection()`
- Produces: `GET /api/posts/<id>` 가 `{_id, title, content, author, views, createdAt}`를 돌려준다. `passwordHash`는 포함되지 않는다. `?countView=1`이 붙으면 조회수가 1 증가한다

---

- [ ] **Step 1: 확인 먼저 — 아직 없는 주소인 것을 본다**

Run:
```bash
curl -i http://localhost:3000/api/posts/000000000000000000000000
```

Expected: 404 (HTML 404 페이지). 아직 `[id].js`가 없다.

---

- [ ] **Step 2: `api/posts/[id].js` 작성**

`api/posts/[id].js`:
```js
import { ObjectId } from 'mongodb';
import { getPostsCollection } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    // 파일명이 [id].js이므로 주소의 그 자리 값이 req.query.id로 들어온다.
    const { id } = req.query;

    // 형식 검사를 먼저 한다.
    // 이걸 빼면 new ObjectId('hello')가 예외를 던져 500이 난다.
    // 500은 "서버가 잘못했다"는 뜻인데 실제로는 요청이 잘못된 것이므로 400이 맞다.
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: '잘못된 요청입니다' });
    }

    // 문자열을 ObjectId 타입으로 바꾼다.
    // 이걸 빼먹으면 "분명 있는 글인데 못 찾는" 현상이 생긴다.
    const _id = new ObjectId(id);

    if (req.method === 'GET') {
      return await getPost(req, res, _id);
    }
    return res.status(405).json({ error: '허용되지 않는 방식입니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getPost(req, res, _id) {
  const col = await getPostsCollection();

  // countView=1일 때만 조회수를 올린다.
  // 수정 화면(edit.html)도 같은 API로 글을 불러오는데,
  // 수정하려고 열었을 때 조회수가 오르면 안 되기 때문이다.
  //
  // $inc는 "지금 값이 뭐든 1을 더해라"라는 뜻이다.
  // 값을 읽어와서 +1 하고 다시 저장하면 동시에 두 명이 들어왔을 때
  // 하나가 씹힌다. $inc는 DB가 한 번에 처리해서 그런 문제가 없다.
  if (req.query.countView === '1') {
    const result = await col.updateOne({ _id }, { $inc: { views: 1 } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: '존재하지 않는 글입니다' });
    }
  }

  const post = await col.findOne({ _id }, { projection: { passwordHash: 0 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  return res.status(200).json(post);
}
```

`updateOne`으로 올리고 `findOne`으로 다시 읽는 두 단계를 쓴다. `findOneAndUpdate` 하나로도 되지만, 그 함수는 드라이버 버전에 따라 반환 형태가 달라(v5 이하는 `result.value`, v6부터는 문서 직접) 버전이 안 맞으면 "데이터가 `undefined`"로 나타난다. 두 단계 방식은 버전과 무관하게 동작하고 읽기도 쉽다. `$inc` 자체는 여전히 원자적이라 조회수가 씹히지 않는다.

---

- [ ] **Step 3: 실제 `_id` 알아내기**

Run:
```bash
curl -s http://localhost:3000/api/posts
```

응답에서 `_id` 값 하나를 복사한다. 아래 단계에서 `<ID>` 자리에 넣는다.

---

- [ ] **Step 4: 다시 확인 — 상세 데이터가 온다**

Run:
```bash
curl -s http://localhost:3000/api/posts/<ID>
```

Expected: `{"_id":"...","title":"...","content":"...","author":"...","views":0,"createdAt":"..."}`

**확인할 것:** `passwordHash`가 응답에 **없어야 한다.**

---

- [ ] **Step 5: 조회수 증가 확인**

Run:
```bash
curl -s "http://localhost:3000/api/posts/<ID>?countView=1" | grep -o '"views":[0-9]*'
curl -s "http://localhost:3000/api/posts/<ID>?countView=1" | grep -o '"views":[0-9]*'
curl -s "http://localhost:3000/api/posts/<ID>" | grep -o '"views":[0-9]*'
```

Expected:
```
"views":1
"views":2
"views":2
```

앞의 두 번은 오르고, `countView` 없는 세 번째는 그대로다.

---

- [ ] **Step 6: 에러 상황 확인**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/posts/hello
```
Expected: `400` — **500이 아니어야 한다**

```bash
curl -s http://localhost:3000/api/posts/hello
```
Expected: `{"error":"잘못된 요청입니다"}`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/posts/000000000000000000000000
```
Expected: `404`

```bash
curl -s http://localhost:3000/api/posts/000000000000000000000000
```
Expected: `{"error":"존재하지 않는 글입니다"}`

---

- [ ] **Step 7: 커밋**

```bash
git add "api/posts/[id].js"
git commit -m "feat: 글 상세 조회 API"
git push
```

---

# Task 8: 상세 화면

**Files:**
- Create: `public/view.html`
- Create: `public/js/view.js`
- Modify: `public/css/style.css` (상세 화면 스타일 추가)

**Interfaces:**
- Consumes: `public/js/api.js`의 `getPost(id, countView)`, `public/js/format.js`의 `formatDateFull(iso)`
- Produces: `view.html?id=<id>` 화면. [수정] 버튼이 `edit.html?id=<id>`로 이동한다 (Task 10). [삭제] 버튼은 Task 11에서 붙인다

---

- [ ] **Step 1: 확인 먼저 — 목록에서 글을 눌러도 404인 것을 본다**

브라우저에서 `http://localhost:3000` → 아무 글 제목 클릭.

Expected: 404 페이지. 주소창은 `view.html?id=...`

---

- [ ] **Step 2: `public/view.html` 작성**

`public/view.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>글 보기 - 자유게시판</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="container">
    <p id="status" class="status">불러오는 중...</p>

    <article id="post" class="post" hidden>
      <h1 id="post-title" class="post-title"></h1>
      <p id="post-meta" class="post-meta"></p>
      <div id="post-content" class="post-content"></div>
    </article>

    <div id="actions" class="post-actions" hidden>
      <a class="btn" href="index.html">목록</a>
      <span class="spacer"></span>
      <a id="edit-link" class="btn" href="#">수정</a>
    </div>
  </main>

  <script type="module" src="js/view.js"></script>
</body>
</html>
```

---

- [ ] **Step 3: `public/js/view.js` 작성**

`public/js/view.js`:
```js
import { getPost } from './api.js';
import { formatDateFull } from './format.js';

const statusEl = document.getElementById('status');
const postEl = document.getElementById('post');
const actionsEl = document.getElementById('actions');
const titleEl = document.getElementById('post-title');
const metaEl = document.getElementById('post-meta');
const contentEl = document.getElementById('post-content');
const editLink = document.getElementById('edit-link');

const id = new URLSearchParams(location.search).get('id');

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

async function load() {
  if (!id) {
    showStatus('잘못된 주소입니다');
    return;
  }

  try {
    // countView=true — 상세 화면을 열었으므로 조회수를 올린다.
    const post = await getPost(id, true);

    // textContent를 쓴다. innerHTML을 쓰면 본문에 넣은
    // <script>alert(1)</script> 가 실제로 실행된다(XSS).
    titleEl.textContent = post.title;
    metaEl.textContent =
      post.author + ' · ' + formatDateFull(post.createdAt) + ' · 조회 ' + post.views;
    contentEl.textContent = post.content;

    editLink.href = 'edit.html?id=' + post._id;

    statusEl.hidden = true;
    postEl.hidden = false;
    actionsEl.hidden = false;
  } catch (err) {
    showStatus(err.message);
  }
}

load();
```

---

- [ ] **Step 4: 상세 화면 스타일 추가**

`public/css/style.css` 끝에 아래를 덧붙인다:
```css
.post {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 28px;
}

.post-title {
  margin: 0 0 10px;
  font-size: 22px;
}

.post-meta {
  margin: 0 0 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
  color: #888;
}

.post-content {
  min-height: 160px;
  /* 서버에서 온 줄바꿈을 화면에 그대로 살린다.
     textContent를 쓰기 때문에 <br>이 아니라 CSS로 처리한다. */
  white-space: pre-wrap;
  word-break: break-word;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.post-actions .spacer {
  flex: 1;
}
```

---

- [ ] **Step 5: 다시 확인 — 글 내용이 보인다**

브라우저에서 `http://localhost:3000` → 글 제목 클릭.

Expected:
- 제목이 큰 글씨로
- 그 아래 `홍길동 · 2026-07-28 14:30 · 조회 N`
- 본문 (줄바꿈이 살아있음)
- 아래에 [목록] [수정] 버튼

---

- [ ] **Step 6: 조회수가 오르는지 확인**

같은 페이지를 3번 새로고침한다.

Expected: `조회 N` 숫자가 새로고침마다 1씩 오른다.

[목록]을 눌러 목록 화면으로 간다. Expected: 그 글의 조회 칸도 같은 숫자다.

---

- [ ] **Step 7: XSS 방어 확인**

이 태스크에서 가장 중요한 확인이다.

[글쓰기]에서 아래처럼 입력하고 등록한다.
- 제목: `XSS 테스트`
- 작성자: `테스터`
- 비밀번호: `1234`
- 내용: `<script>alert('XSS')</script>` 와 `<img src=x onerror=alert('XSS2')>` 두 줄

Expected:
- **경고창(alert)이 뜨지 않는다**
- 본문에 태그가 **글자 그대로** 보인다
- 목록 화면에서도 제목이 그대로 보인다

`innerHTML`을 썼다면 여기서 경고창이 떴을 것이다.

---

- [ ] **Step 8: 없는 글 접근 확인**

브라우저 주소창에 직접 입력:

```
http://localhost:3000/view.html?id=000000000000000000000000
```
Expected: **"존재하지 않는 글입니다"**

```
http://localhost:3000/view.html?id=hello
```
Expected: **"잘못된 요청입니다"**

---

- [ ] **Step 9: 커밋**

```bash
git add public/view.html public/js/view.js public/css/style.css
git commit -m "feat: 글 상세 화면"
git push
```

---

# Task 9: 글 수정 API

**Files:**
- Modify: `api/posts/[id].js` (`PUT` 처리 추가)

**Interfaces:**
- Consumes: `lib/db.js`의 `getPostsCollection()`, `lib/validate.js`의 `validateUpdate(body)`
- Produces: `PUT /api/posts/<id>` — 비밀번호가 맞으면 `title`과 `content`를 수정하고 `200`과 `{ _id: string }`을 돌려준다. 틀리면 `401`

---

- [ ] **Step 1: 확인 먼저 — PUT이 거부되는 것을 본다**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"title":"수정된 제목","content":"수정된 내용","password":"1234"}'
```

Expected: `405`

---

- [ ] **Step 2: `api/posts/[id].js` 상단 import 교체**

파일 맨 위 두 줄을 아래로 교체:
```js
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getPostsCollection } from '../../lib/db.js';
import { validateUpdate } from '../../lib/validate.js';
```

---

- [ ] **Step 3: `handler`에 `PUT` 분기 추가**

`if (req.method === 'GET') { ... }` 블록 **바로 아래**에 삽입:
```js
    if (req.method === 'PUT') {
      return await updatePost(req, res, _id);
    }
```

---

- [ ] **Step 4: 파일 맨 아래에 `updatePost` 함수 추가**

```js
async function updatePost(req, res, _id) {
  const { error, value } = validateUpdate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const col = await getPostsCollection();

  // 비밀번호 확인을 위해 해시만 가져온다.
  const post = await col.findOne({ _id }, { projection: { passwordHash: 1 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  // bcrypt.compare는 입력값을 같은 방식으로 해시해서 비교한다.
  // 저장된 해시를 원문으로 되돌리는 것이 아니다. 해시는 되돌릴 수 없다.
  const matched = await bcrypt.compare(value.password, post.passwordHash);
  if (!matched) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  // author와 createdAt은 건드리지 않는다. 작성자가 바뀌면 안 된다.
  await col.updateOne(
    { _id },
    { $set: { title: value.title, content: value.content } }
  );

  return res.status(200).json({ _id: _id.toString() });
}
```

---

- [ ] **Step 5: 다시 확인 — 올바른 비밀번호로 수정된다**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"title":"수정된 제목","content":"수정된 내용","password":"1234"}'
```
Expected: `200`

브라우저에서 `http://localhost:3000` 접속. Expected: 제목이 **"수정된 제목"**으로 바뀌어 있다.

---

- [ ] **Step 6: 틀린 비밀번호로 거부되는지 확인**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"title":"해킹 시도","content":"내용","password":"wrongpw"}'
```
Expected: `401`

```bash
curl -s -X PUT http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"title":"해킹 시도","content":"내용","password":"wrongpw"}'
```
Expected: `{"error":"비밀번호가 일치하지 않습니다"}`

목록 화면에서 제목이 **"해킹 시도"로 바뀌지 않았는지** 확인한다.

---

- [ ] **Step 7: 작성자와 작성일이 보존되는지 확인**

Run:
```bash
curl -s http://localhost:3000/api/posts/<ID>
```

Expected: `author`와 `createdAt`이 수정 전과 같다. `title`과 `content`만 바뀌었다.

---

- [ ] **Step 8: 커밋**

```bash
git add "api/posts/[id].js"
git commit -m "feat: 글 수정 API"
git push
```

---

# Task 10: 수정 화면

**Files:**
- Create: `public/edit.html`
- Create: `public/js/edit.js`

**Interfaces:**
- Consumes: `public/js/api.js`의 `getPost(id, countView)`와 `updatePost(id, data)`
- Produces: `edit.html?id=<id>` 화면. 저장 성공 시 `view.html?id=<id>`로 이동한다

---

- [ ] **Step 1: 확인 먼저 — [수정] 버튼이 404인 것을 본다**

브라우저에서 글 상세 화면 → **[수정]** 클릭.

Expected: 404 페이지. 주소창은 `edit.html?id=...`

---

- [ ] **Step 2: `public/edit.html` 작성**

`public/edit.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>글 수정 - 자유게시판</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="container">
    <header class="page-header">
      <h1>글 수정</h1>
    </header>

    <p id="status" class="status">불러오는 중...</p>

    <form id="post-form" class="form" novalidate hidden>
      <div class="field">
        <label for="title">제목</label>
        <input type="text" id="title" maxlength="100" autocomplete="off">
      </div>

      <div class="field">
        <label>작성자</label>
        <div id="author" class="readonly-value"></div>
      </div>

      <div class="field">
        <label for="content">내용</label>
        <textarea id="content" rows="12" maxlength="5000"></textarea>
      </div>

      <div class="field">
        <label for="password">비밀번호</label>
        <input type="password" id="password" autocomplete="current-password">
        <p class="hint">글을 쓸 때 입력한 비밀번호를 넣어주세요.</p>
      </div>

      <p id="error" class="error" hidden></p>

      <div class="form-actions">
        <a id="cancel" class="btn" href="index.html">취소</a>
        <button type="submit" id="submit" class="btn btn-primary">저장</button>
      </div>
    </form>
  </main>

  <script type="module" src="js/edit.js"></script>
</body>
</html>
```

---

- [ ] **Step 3: `public/js/edit.js` 작성**

`public/js/edit.js`:
```js
import { getPost, updatePost } from './api.js';

const statusEl = document.getElementById('status');
const form = document.getElementById('post-form');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');
const cancelLink = document.getElementById('cancel');

const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const passwordInput = document.getElementById('password');
const authorEl = document.getElementById('author');

const id = new URLSearchParams(location.search).get('id');

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
}

async function load() {
  if (!id) {
    showStatus('잘못된 주소입니다');
    return;
  }

  try {
    // countView를 넘기지 않는다. 수정하러 온 것이지 읽으러 온 게 아니므로
    // 조회수가 오르면 안 된다.
    const post = await getPost(id);

    // 입력칸에 기존 값을 채운다.
    // value에 넣는 것은 HTML로 해석되지 않으므로 XSS 위험이 없다.
    titleInput.value = post.title;
    contentInput.value = post.content;
    authorEl.textContent = post.author;
    cancelLink.href = 'view.html?id=' + post._id;

    statusEl.hidden = true;
    form.hidden = false;
  } catch (err) {
    showStatus(err.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const data = {
    title: titleInput.value,
    content: contentInput.value,
    password: passwordInput.value,
  };

  if (!data.title.trim()) {
    showError('제목을 입력해주세요');
    return;
  }
  if (!data.content.trim()) {
    showError('내용을 입력해주세요');
    return;
  }
  if (!data.password) {
    showError('비밀번호를 입력해주세요');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '저장 중...';

  try {
    await updatePost(id, data);
    location.href = 'view.html?id=' + id;
  } catch (err) {
    // 실패해도 입력한 제목·내용은 그대로 둔다.
    // 길게 쓴 글이 비밀번호 오타 한 번에 날아가면 안 된다.
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '저장';
  }
});

load();
```

---

- [ ] **Step 4: 다시 확인 — 화면에서 글이 수정된다**

브라우저에서 글 상세 → **[수정]**.

Expected: 제목과 내용에 **기존 값이 채워져 있다.** 작성자는 회색 글씨로 표시되고 고칠 수 없다.

제목을 고치고 비밀번호 `1234`를 입력한 뒤 **[저장]**.

Expected: 상세 화면으로 이동하고 제목이 바뀌어 있다.

---

- [ ] **Step 5: 틀린 비밀번호일 때 입력 내용이 보존되는지 확인**

다시 [수정]으로 들어가서 제목을 `보존 확인용 제목`으로 고치고, 비밀번호에 틀린 값을 입력한 뒤 [저장].

Expected:
- **"비밀번호가 일치하지 않습니다"**가 빨간 박스로 뜬다
- **제목 입력칸에 `보존 확인용 제목`이 그대로 남아 있다**
- [저장] 버튼이 다시 눌리는 상태가 된다

---

- [ ] **Step 6: 수정 화면에서 조회수가 오르지 않는지 확인**

1. 목록 화면에서 그 글의 조회수를 적어둔다
2. 상세로 들어가지 말고, 주소창에 `edit.html?id=<ID>`를 직접 입력해 수정 화면을 3번 연다
3. 목록 화면으로 돌아가 조회수를 확인한다

Expected: **숫자가 그대로다.** 수정 화면은 `countView`를 붙이지 않기 때문이다.

---

- [ ] **Step 7: 커밋**

```bash
git add public/edit.html public/js/edit.js
git commit -m "feat: 글 수정 화면"
git push
```

---

# Task 11: 글 삭제

**Files:**
- Modify: `api/posts/[id].js` (`DELETE` 처리 추가)
- Modify: `public/view.html` (삭제 버튼과 비밀번호 입력 영역 추가)
- Modify: `public/js/view.js` (삭제 로직 추가)
- Modify: `public/css/style.css` (삭제 영역 스타일 추가)

**Interfaces:**
- Consumes: `public/js/api.js`의 `deletePost(id, password)`
- Produces: `DELETE /api/posts/<id>` — 비밀번호가 맞으면 글을 지우고 `204`를 돌려준다. 화면에서는 삭제 후 `index.html`로 이동한다

---

- [ ] **Step 1: 확인 먼저 — DELETE가 거부되는 것을 본다**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"password":"1234"}'
```

Expected: `405`

---

- [ ] **Step 2: `handler`에 `DELETE` 분기 추가**

`if (req.method === 'PUT') { ... }` 블록 **바로 아래**에 삽입:
```js
    if (req.method === 'DELETE') {
      return await deletePost(req, res, _id);
    }
```

---

- [ ] **Step 3: 파일 맨 아래에 `deletePost` 함수 추가**

```js
async function deletePost(req, res, _id) {
  // DELETE 요청도 본문(body)에 비밀번호를 담아 보낸다.
  // fetch의 DELETE + body 조합은 정상 동작하며,
  // Vercel의 Node.js 런타임이 Content-Type을 보고 req.body로 파싱해 준다.
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해주세요' });
  }

  const col = await getPostsCollection();

  const post = await col.findOne({ _id }, { projection: { passwordHash: 1 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  const matched = await bcrypt.compare(password, post.passwordHash);
  if (!matched) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  await col.deleteOne({ _id });

  // 204 No Content — 성공했고 돌려줄 본문이 없다는 뜻.
  // .json()이 아니라 .end()를 쓴다.
  return res.status(204).end();
}
```

---

- [ ] **Step 4: API 확인 — 틀린 비밀번호는 거부된다**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/posts/<ID> -H "Content-Type: application/json" -d '{"password":"wrongpw"}'
```
Expected: `401`

```bash
curl -s http://localhost:3000/api/posts/<ID> | grep -o '"title":"[^"]*"'
```
Expected: 글이 **여전히 존재한다.**

---

- [ ] **Step 5: `public/view.html`에 삭제 UI 추가**

`<div id="actions" class="post-actions" hidden>` 블록 전체를 아래로 교체:
```html
    <div id="actions" class="post-actions" hidden>
      <a class="btn" href="index.html">목록</a>
      <span class="spacer"></span>
      <a id="edit-link" class="btn" href="#">수정</a>
      <button type="button" id="delete-btn" class="btn btn-danger">삭제</button>
    </div>

    <div id="delete-box" class="delete-box" hidden>
      <label for="delete-password">비밀번호</label>
      <input type="password" id="delete-password" autocomplete="current-password">
      <button type="button" id="delete-confirm" class="btn btn-danger">확인</button>
      <button type="button" id="delete-cancel" class="btn">취소</button>
      <p id="delete-error" class="error" hidden></p>
    </div>
```

`confirm()`이나 `prompt()` 같은 브라우저 기본 팝업을 쓰지 않는다. 스타일을 줄 수 없고, 자동화 도구를 쓸 때 화면 전체를 멈추게 한다.

---

- [ ] **Step 6: `public/js/view.js`에 삭제 로직 추가**

맨 위 import 줄을 아래로 교체:
```js
import { getPost, deletePost } from './api.js';
import { formatDateFull } from './format.js';
```

`const editLink = ...` 아래에 요소 참조를 추가:
```js
const deleteBtn = document.getElementById('delete-btn');
const deleteBox = document.getElementById('delete-box');
const deletePassword = document.getElementById('delete-password');
const deleteConfirm = document.getElementById('delete-confirm');
const deleteCancel = document.getElementById('delete-cancel');
const deleteError = document.getElementById('delete-error');
```

파일 맨 아래의 `load();` **위에** 아래를 추가:
```js
deleteBtn.addEventListener('click', () => {
  deleteBox.hidden = false;
  deleteError.hidden = true;
  deletePassword.value = '';
  deletePassword.focus();
});

deleteCancel.addEventListener('click', () => {
  deleteBox.hidden = true;
});

deleteConfirm.addEventListener('click', async () => {
  deleteError.hidden = true;

  const password = deletePassword.value;
  if (!password) {
    deleteError.textContent = '비밀번호를 입력해주세요';
    deleteError.hidden = false;
    return;
  }

  deleteConfirm.disabled = true;
  deleteConfirm.textContent = '삭제 중...';

  try {
    await deletePost(id, password);
    location.href = 'index.html';
  } catch (err) {
    deleteError.textContent = err.message;
    deleteError.hidden = false;
    deleteConfirm.disabled = false;
    deleteConfirm.textContent = '확인';
  }
});
```

---

- [ ] **Step 7: 삭제 영역 스타일 추가**

`public/css/style.css` 끝에 아래를 덧붙인다:
```css
.btn-danger {
  border-color: #c0392b;
  color: #c0392b;
}

.btn-danger:hover {
  background: #fdecec;
}

.delete-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #f0c8c4;
  border-radius: 6px;
  background: #fff8f8;
}

.delete-box label {
  font-size: 14px;
  font-weight: 600;
}

.delete-box input {
  flex: 1;
  min-width: 160px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 15px;
}

.delete-box .error {
  flex-basis: 100%;
  margin: 4px 0 0;
}
```

---

- [ ] **Step 8: 다시 확인 — 틀린 비밀번호는 거부된다**

브라우저에서 글 상세 → **[삭제]**.

Expected: 아래에 비밀번호 입력 영역이 펼쳐진다. **브라우저 기본 팝업은 뜨지 않는다.**

틀린 비밀번호를 넣고 [확인].

Expected:
- **"비밀번호가 일치하지 않습니다"**
- 글이 그대로 남아 있다
- [취소]를 누르면 입력 영역이 닫힌다

---

- [ ] **Step 9: 올바른 비밀번호로 삭제되는지 확인**

`XSS 테스트` 글을 열고 [삭제] → 비밀번호 `1234` → [확인].

Expected:
- 목록 화면으로 이동한다
- **`XSS 테스트` 글이 목록에서 사라졌다**

---

- [ ] **Step 10: 삭제된 글의 주소로 접근 확인**

삭제 직전의 상세 주소를 다시 연다 (브라우저 뒤로가기 또는 주소 직접 입력).

Expected: **"존재하지 않는 글입니다"**

---

- [ ] **Step 11: 커밋**

```bash
git add "api/posts/[id].js" public/view.html public/js/view.js public/css/style.css
git commit -m "feat: 글 삭제 - CRUD 4종 완성"
git push
```

---

# Task 12: 페이징 확인과 전체 검증

**Files:**
- Create: `scripts/seed.js`

**Interfaces:**
- Consumes: 앞의 모든 태스크
- Produces: 설계 문서의 검증 시나리오 15개가 전부 통과한 상태

---

- [ ] **Step 1: 확인 먼저 — 아직 페이지 버튼이 없는 것을 본다**

브라우저에서 `http://localhost:3000` 접속.

Expected: 글이 10개 미만이라 페이지 버튼이 **보이지 않는다.** `renderPagination`이 `totalPages <= 1`이면 아무것도 그리지 않기 때문이다.

---

- [ ] **Step 2: 더미 글 생성 스크립트 작성**

`scripts/seed.js`:
```js
// 페이징 확인용 더미 글을 넣는 스크립트.
// 손으로 15개를 쓰는 것은 시간 낭비다.
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다.');
}

const COUNT = 15;
const client = await new MongoClient(uri).connect();

try {
  const col = client.db('board').collection('posts');
  const passwordHash = await bcrypt.hash('1234', 10);
  const now = Date.now();

  const docs = Array.from({ length: COUNT }, (_, i) => ({
    title: '테스트 글 ' + (i + 1),
    content: (i + 1) + '번째 테스트 글의 내용입니다.',
    author: '테스터',
    passwordHash,
    views: 0,
    // 1분씩 차이를 둬서 정렬 순서를 확인할 수 있게 한다.
    createdAt: new Date(now + i * 60000),
  }));

  const result = await col.insertMany(docs);
  console.log('더미 글 ' + result.insertedCount + '개 생성 완료 (비밀번호는 모두 1234)');
} finally {
  await client.close();
}
```

---

- [ ] **Step 3: 더미 글 생성**

Run:
```bash
node --env-file=.env.local scripts/seed.js
```
Expected: `더미 글 15개 생성 완료 (비밀번호는 모두 1234)`

---

- [ ] **Step 4: 페이징 확인**

브라우저에서 `http://localhost:3000` 접속.

Expected:
- 표에 글이 **정확히 10개**
- 맨 위가 `테스트 글 15` (가장 최근)
- 아래에 페이지 버튼 `1 2` — `1`이 파란색으로 강조

**[2]** 클릭.

Expected:
- 주소가 `index.html?page=2`
- 나머지 글들이 보인다
- 번호가 이어진다 (1페이지 마지막이 8이면 2페이지 첫 줄은 7)
- `2`가 파란색으로 강조

---

- [ ] **Step 5: 설계 문서의 검증 시나리오 15개 실행**

설계 문서 10장의 시나리오를 순서대로 실행한다. **개발자도구 Network 탭을 켜둔 상태로** 진행한다.

정상 흐름:
- [ ] 1. 글 작성 → 상세 페이지로 이동됨, 내용이 맞음
- [ ] 2. 목록에 새 글이 맨 위에 보임
- [ ] 3. 상세를 새로고침 → 조회수가 1씩 오름
- [ ] 4. 수정 → 내용이 바뀜, 작성자·작성일은 그대로
- [ ] 5. 수정 화면을 열었다 닫음 → 조회수 안 오름
- [ ] 6. 삭제 → 목록으로 돌아감, 그 글이 사라짐
- [ ] 7. 글 11개 이상 → 2페이지 버튼이 생기고 정상 동작

실패 흐름:
- [ ] 8. 제목 없이 등록 → "제목을 입력해주세요"
- [ ] 9. 틀린 비밀번호로 수정 → 401, 입력한 내용은 유지됨
- [ ] 10. 틀린 비밀번호로 삭제 → 401, 글이 안 지워짐
- [ ] 11. 삭제된 글의 주소로 접근 → "존재하지 않는 글입니다"
- [ ] 12. `view.html?id=hello` → 400 (500 아님)

보안 확인:
- [ ] 13. Network 탭에서 **어떤 응답에도 `passwordHash`가 없는지** 확인
- [ ] 14. 본문에 스크립트 태그 저장 → 글자 그대로 보임, 팝업 안 뜸
- [ ] 15. `curl`로 제목 200자 전송 → 400으로 거부됨

13번 확인 방법: Network 탭에서 `posts` 요청들을 하나씩 클릭해 Response를 열고 `passwordHash`를 검색한다. 하나도 나오면 안 된다.

15번 명령:
```bash
LONG=$(printf 'A%.0s' {1..200})
curl -s -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d "{\"title\":\"$LONG\",\"content\":\"내용\",\"author\":\"홍길동\",\"password\":\"1234\"}"
```

**실패한 항목이 있으면 그 원인을 고친 뒤 다시 실행한다.** 전부 통과해야 다음 태스크로 넘어간다.

---

- [ ] **Step 6: 더미 글 정리 (선택)**

배포 전에 테스트 글을 지우고 싶으면:
```bash
node --env-file=.env.local -e "import('mongodb').then(async (m) => { const c = await new m.MongoClient(process.env.MONGODB_URI).connect(); const r = await c.db('board').collection('posts').deleteMany({author:'테스터'}); console.log('삭제:', r.deletedCount); await c.close(); })"
```

남겨둬도 무방하다. 배포 후 화면에서 하나씩 지워보는 것도 삭제 기능 확인이 된다.

---

- [ ] **Step 7: 커밋**

```bash
git add scripts/seed.js
git commit -m "test: 페이징 확인용 시드 스크립트와 전체 검증"
git push
```

---

# Task 13: Vercel 배포

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-board-crud-design.md` (배포 주소 기록)

**Interfaces:**
- Consumes: 앞의 모든 태스크
- Produces: 인터넷에서 접속 가능한 게시판 주소

---

- [ ] **Step 1: 확인 먼저 — 아직 인터넷에 없는 것을 본다**

Run:
```bash
vercel ls
```

Expected: `bulletin` 프로젝트가 없거나, 있어도 배포 이력이 없다.

---

- [ ] **Step 2: 모든 변경사항이 푸시됐는지 확인**

Run:
```bash
git status --short --branch
```
Expected: `## main...origin/main` 만 출력되고 그 아래 파일 목록이 없다. 남은 게 있으면 커밋하고 푸시한다.

---

- [ ] **Step 3: Vercel에 GitHub 레포 연결**

1. https://vercel.com/new 접속
2. **Import Git Repository**에서 `ssenu/Bulletin` 선택 → **Import**
3. Framework Preset: **Other**
4. Root Directory: `./` (기본값)
5. Build and Output Settings는 건드리지 않는다 (빌드 단계가 없다)
6. **Environment Variables**에 추가:
   - Name: `MONGODB_URI`
   - Value: `.env.local`에 넣은 것과 **똑같은 값**
   - Environments: Production, Preview, Development **모두 체크**
7. **Deploy**

`MONGODB_URI`를 빠뜨리면 배포는 되지만 모든 API가 500을 낸다. 가장 흔한 실수다.

---

- [ ] **Step 4: 배포 확인**

배포가 끝나면 `https://bulletin-xxxx.vercel.app` 형태의 주소가 나온다.

브라우저에서 접속.

Expected:
- 목록 화면이 뜬다
- 로컬에서 쓴 글들이 그대로 보인다

**같은 Atlas DB를 로컬과 배포본이 함께 쓴다.** 로컬에서 쓴 글이 인터넷 주소에서도 보이는 이유다.

---

- [ ] **Step 5: 배포본에서 CRUD 전체 확인**

배포된 주소에서 아래를 순서대로 해본다.

- [ ] 글 작성 → 상세로 이동
- [ ] 목록에 나타남
- [ ] 상세 새로고침 → 조회수 오름
- [ ] 수정 (올바른 비밀번호)
- [ ] 수정 시도 (틀린 비밀번호) → 거부됨
- [ ] 삭제 → 목록에서 사라짐

**문제 해결:** API가 500을 내면 Vercel 대시보드 → 프로젝트 → **Logs**에서 실제 에러를 확인한다. `MONGODB_URI` 누락이나 Atlas Network Access(`0.0.0.0/0`) 미설정이 대부분이다.

---

- [ ] **Step 6: 휴대폰에서 접속해보기**

같은 주소를 휴대폰 브라우저에서 연다.

Expected: 게시판이 뜨고 글을 쓸 수 있다.

내가 만든 것이 **실제로 인터넷에 있다**는 것을 확인하는 단계다.

---

- [ ] **Step 7: 배포 주소를 설계 문서에 기록**

`docs/superpowers/specs/2026-07-28-board-crud-design.md`의 `## 1. 목적과 범위` 바로 위에 추가:

```markdown
**배포 주소:** https://bulletin-xxxx.vercel.app
**레포:** https://github.com/ssenu/Bulletin
```

`xxxx` 부분은 실제 주소로 바꾼다.

---

- [ ] **Step 8: 커밋**

```bash
git add docs/superpowers/specs/2026-07-28-board-crud-design.md
git commit -m "docs: 배포 주소 기록"
git push
```

---

- [ ] **Step 9: 자동 배포 확인**

Step 8의 `git push` 후 Vercel 대시보드를 연다.

Expected: 새 배포가 자동으로 시작된다.

**이제 `git push`만 하면 인터넷의 사이트가 갱신된다.** GitHub과 Vercel이 연결되어 있기 때문이다.

---

# 완료 후 확장 과제

설계 문서에서 의도적으로 제외한 것들이다. CRUD 흐름이 손에 익은 뒤 하나씩 붙이면 좋다.

| 과제 | 새로 배우는 것 | 난이도 |
|---|---|---|
| 제목·작성자 검색 | 조건부 조회(`$regex`), 쿼리 파라미터 조합 | 낮음 |
| 수정일시 표시 | 필드 추가, "수정됨" 표시 조건 | 낮음 |
| 댓글 | 1:N 관계, 별도 컬렉션 또는 배열 필드 | 중간 |
| 로그인·회원가입 | 세션 또는 JWT, 인증과 인가의 차이 | 높음 |
| 파일 첨부 | 파일 저장소(Vercel Blob 등), 업로드 처리 | 높음 |
| 같은 게시판을 서버 렌더링으로 | SSR과 CSR의 차이를 몸으로 비교 | 중간 |

마지막 항목이 특히 추천할 만하다. 지금 만든 것과 정확히 같은 기능을, 서버가 HTML을 만들어 보내는 방식으로 다시 만들면 두 구조의 차이가 선명하게 보인다.
