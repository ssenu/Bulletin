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
