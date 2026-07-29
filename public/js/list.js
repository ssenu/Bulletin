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

    // 페이지 버튼은 글이 없는 페이지(범위 밖 page=99 등)에서도 그려야
    // 사용자가 목록으로 돌아갈 수 있다. 그래서 빈 목록으로 돌아가는
    // 경우에도 renderPagination을 먼저 실행하고, 그 다음에 안내 문구를 보여준다.
    renderPagination(data.currentPage, data.totalPages);

    if (data.posts.length === 0) {
      showStatus('등록된 글이 없습니다');
      return;
    }

    hideStatus();
    renderRows(data.posts, data.totalCount, data.currentPage);
  } catch (err) {
    showStatus(err.message);
  }
}

load();
