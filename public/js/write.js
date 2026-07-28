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
