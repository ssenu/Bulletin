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

  // 2xx인데 본문이 JSON이 아닌 경우. 정상 응답이라면 여기 올 수 없다.
  // 그대로 null을 돌려주면 호출한 쪽에서 영어 TypeError가 나므로 여기서 막는다.
  if (data === null) {
    throw new Error('요청을 처리하지 못했습니다');
  }

  return data;
}

export function getPosts(page = 1) {
  return request('/api/posts?page=' + page);
}

// id는 주소창(location.search)에서 그대로 오므로 경로에 안전하다고 믿을 수 없다.
// encodeURIComponent로 감싸서 '/', '..' 같은 문자가 경로 구분자로 해석되지 않게 한다.
export function getPost(id, countView = false) {
  // countView가 true일 때만 조회수가 오른다.
  // 수정 화면에서 글을 불러올 때는 조회수가 오르면 안 된다.
  const query = countView ? '?countView=1' : '';
  return request('/api/posts/' + encodeURIComponent(id) + query);
}

export function createPost(data) {
  return request('/api/posts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
}

export function updatePost(id, data) {
  return request('/api/posts/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
}

export function deletePost(id, password) {
  return request('/api/posts/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ password }),
  });
}
