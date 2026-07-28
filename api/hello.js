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
