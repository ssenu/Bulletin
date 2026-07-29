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

export function validateCreate(body) {
  const input = body ?? {};
  const title = asText(input.title);
  const content = asText(input.content);
  const author = asText(input.author);
  // 비밀번호는 trim하지 않는다. 공백도 비밀번호의 일부일 수 있다.
  const password = typeof input.password === 'string' ? input.password : '';

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

export function validateUpdate(body) {
  const input = body ?? {};
  const title = asText(input.title);
  const content = asText(input.content);
  const password = typeof input.password === 'string' ? input.password : '';

  const textError = checkTitleAndContent(title, content);
  if (textError) return { error: textError };

  if (!password) return { error: '비밀번호를 입력해주세요' };

  return { value: { title, content, password } };
}
