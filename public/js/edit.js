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
