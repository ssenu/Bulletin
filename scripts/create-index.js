// 한 번만 실행하면 되는 스크립트.
// 목록 조회는 항상 createdAt 내림차순으로 정렬한다.
// 인덱스가 없으면 글이 많아졌을 때 DB가 전체를 훑어가며 정렬해야 해서 느려진다.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다.');
}

const client = await new MongoClient(uri).connect();

try {
  const name = await client
    .db('board')
    .collection('posts')
    .createIndex({ createdAt: -1 });

  console.log('인덱스 생성 완료:', name);
} finally {
  await client.close();
}
