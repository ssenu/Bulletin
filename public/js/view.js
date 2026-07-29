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
