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
