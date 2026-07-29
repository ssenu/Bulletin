// 페이징 확인용 더미 글을 넣는 스크립트.
// 손으로 15개를 쓰는 것은 시간 낭비다.
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다.');
}

const COUNT = 15;
const client = await new MongoClient(uri).connect();

try {
  const col = client.db('board').collection('posts');
  const passwordHash = await bcrypt.hash('1234', 10);
  const now = Date.now();

  const docs = Array.from({ length: COUNT }, (_, i) => ({
    title: '테스트 글 ' + (i + 1),
    content: (i + 1) + '번째 테스트 글의 내용입니다.',
    author: '테스터',
    passwordHash,
    views: 0,
    // 1분씩 차이를 둬서 정렬 순서를 확인할 수 있게 한다.
    // 모두 과거 시각이어야 한다. 미래로 잡으면 이 다음에 사용자가 쓴 진짜 글이
    // 목록에서 더미 글 아래로 밀려 "새 글이 맨 위에 보임" 확인이 실패한다.
    createdAt: new Date(now - (COUNT - 1 - i) * 60000),
  }));

  const result = await col.insertMany(docs);
  console.log('더미 글 ' + result.insertedCount + '개 생성 완료 (비밀번호는 모두 1234)');
} finally {
  await client.close();
}
