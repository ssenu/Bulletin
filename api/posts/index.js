import bcrypt from 'bcryptjs';
import { getPostsCollection } from '../../lib/db.js';
import { validateCreate } from '../../lib/validate.js';

const PER_PAGE = 10;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await listPosts(req, res);
    }
    if (req.method === 'POST') {
      return await createPost(req, res);
    }
    return res.status(405).json({ error: '허용되지 않는 방식입니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function listPosts(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * PER_PAGE;

  const col = await getPostsCollection();

  const totalCount = await col.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const posts = await col
    .find({}, { projection: { content: 0, passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(PER_PAGE)
    .toArray();

  return res.status(200).json({ posts, currentPage: page, totalPages, totalCount });
}

async function createPost(req, res) {
  const { error, value } = validateCreate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const col = await getPostsCollection();

  // 비밀번호는 해시해서 저장한다. 원문은 어디에도 남기지 않는다.
  // 10은 해시 강도다. 숫자가 클수록 안전하지만 느려진다.
  const passwordHash = await bcrypt.hash(value.password, 10);

  const result = await col.insertOne({
    title: value.title,
    content: value.content,
    author: value.author,
    passwordHash,
    views: 0,
    createdAt: new Date(),
  });

  // 브라우저가 곧바로 상세 페이지로 이동할 수 있게 _id를 돌려준다.
  return res.status(201).json({ _id: result.insertedId });
}
