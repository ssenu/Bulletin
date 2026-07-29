import { getPost, deletePost } from './api.js';
import { formatDateFull } from './format.js';

const statusEl = document.getElementById('status');
const postEl = document.getElementById('post');
const actionsEl = document.getElementById('actions');
const titleEl = document.getElementById('post-title');
const metaEl = document.getElementById('post-meta');
const contentEl = document.getElementById('post-content');
const editLink = document.getElementById('edit-link');
const deleteBtn = document.getElementById('delete-btn');
const deleteBox = document.getElementById('delete-box');
const deletePassword = document.getElementById('delete-password');
const deleteConfirm = document.getElementById('delete-confirm');
const deleteCancel = document.getElementById('delete-cancel');
const deleteError = document.getElementById('delete-error');

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

load();
