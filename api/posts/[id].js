import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getPostsCollection } from '../../lib/db.js';
import { validateUpdate } from '../../lib/validate.js';

export default async function handler(req, res) {
  try {
    // 파일명이 [id].js이므로 주소의 그 자리 값이 req.query.id로 들어온다.
    const { id } = req.query;

    // 형식 검사를 먼저 한다.
    // 이걸 빼면 new ObjectId('hello')가 예외를 던져 500이 난다.
    // 500은 "서버가 잘못했다"는 뜻인데 실제로는 요청이 잘못된 것이므로 400이 맞다.
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: '잘못된 요청입니다' });
    }

    // 문자열을 ObjectId 타입으로 바꾼다.
    // 이걸 빼먹으면 "분명 있는 글인데 못 찾는" 현상이 생긴다.
    const _id = new ObjectId(id);

    if (req.method === 'GET') {
      return await getPost(req, res, _id);
    }
    if (req.method === 'PUT') {
      return await updatePost(req, res, _id);
    }
    if (req.method === 'DELETE') {
      return await deletePost(req, res, _id);
    }
    return res.status(405).json({ error: '허용되지 않는 방식입니다' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
}

async function getPost(req, res, _id) {
  const col = await getPostsCollection();

  // countView=1일 때만 조회수를 올린다.
  // 수정 화면(edit.html)도 같은 API로 글을 불러오는데,
  // 수정하려고 열었을 때 조회수가 오르면 안 되기 때문이다.
  //
  // $inc는 "지금 값이 뭐든 1을 더해라"라는 뜻이다.
  // 값을 읽어와서 +1 하고 다시 저장하면 동시에 두 명이 들어왔을 때
  // 하나가 씹힌다. $inc는 DB가 한 번에 처리해서 그런 문제가 없다.
  if (req.query.countView === '1') {
    const result = await col.updateOne({ _id }, { $inc: { views: 1 } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: '존재하지 않는 글입니다' });
    }
  }

  const post = await col.findOne({ _id }, { projection: { passwordHash: 0 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  return res.status(200).json(post);
}

async function updatePost(req, res, _id) {
  const { error, value } = validateUpdate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const col = await getPostsCollection();

  // 비밀번호 확인을 위해 해시만 가져온다.
  const post = await col.findOne({ _id }, { projection: { passwordHash: 1 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  // Atlas UI에서 손으로 넣은 문서처럼 passwordHash가 없는 글이 있을 수 있다.
  // 그대로 bcrypt.compare에 넘기면 500이 난다. 비밀번호가 없는 글은 수정·삭제할 수 없다.
  if (!post.passwordHash) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  // bcrypt.compare는 입력값을 같은 방식으로 해시해서 비교한다.
  // 저장된 해시를 원문으로 되돌리는 것이 아니다. 해시는 되돌릴 수 없다.
  const matched = await bcrypt.compare(value.password, post.passwordHash);
  if (!matched) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  // author와 createdAt은 건드리지 않는다. 작성자가 바뀌면 안 된다.
  await col.updateOne(
    { _id },
    { $set: { title: value.title, content: value.content } }
  );

  return res.status(200).json({ _id: _id.toString() });
}

async function deletePost(req, res, _id) {
  // DELETE 요청도 본문(body)에 비밀번호를 담아 보낸다.
  // fetch의 DELETE + body 조합은 정상 동작하며,
  // Vercel의 Node.js 런타임이 Content-Type을 보고 req.body로 파싱해 준다.
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해주세요' });
  }

  const col = await getPostsCollection();

  const post = await col.findOne({ _id }, { projection: { passwordHash: 1 } });
  if (!post) {
    return res.status(404).json({ error: '존재하지 않는 글입니다' });
  }

  // Atlas UI에서 손으로 넣은 문서처럼 passwordHash가 없는 글이 있을 수 있다.
  // 그대로 bcrypt.compare에 넘기면 500이 난다. 비밀번호가 없는 글은 수정·삭제할 수 없다.
  if (!post.passwordHash) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  const matched = await bcrypt.compare(password, post.passwordHash);
  if (!matched) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
  }

  await col.deleteOne({ _id });

  // 204 No Content — 성공했고 돌려줄 본문이 없다는 뜻.
  // .json()이 아니라 .end()를 쓴다.
  return res.status(204).end();
}
