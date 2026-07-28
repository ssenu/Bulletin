import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 없습니다. .env.local 파일을 확인하세요.');
}

// 연결을 전역에 캐시한다.
//
// 서버리스 함수는 요청이 올 때만 깨어나지만, 한 번 깨어난 인스턴스는
// 잠시 살아있다가 다음 요청에 재사용된다. 이때 모듈 스코프 변수도 살아있다.
// 매 요청마다 새로 연결하면 MongoDB Atlas 무료 티어의 연결 한도(500개)를
// 금방 넘겨 "connection limit exceeded"로 터진다.
//
// globalThis에 담는 이유는 vercel dev가 모듈을 다시 불러올 때도
// 연결이 중복 생성되지 않게 하기 위함이다.
let clientPromise = globalThis._mongoClientPromise;

if (!clientPromise) {
  clientPromise = new MongoClient(uri).connect().catch((err) => {
    // 실패한 연결은 캐시에서 지운다.
    // 지우지 않으면 실패한 Promise가 계속 재사용되어, 원인을 고친 뒤에도
    // 이 인스턴스가 사라질 때까지 모든 요청이 같은 에러를 낸다.
    globalThis._mongoClientPromise = undefined;
    throw err;
  });
  globalThis._mongoClientPromise = clientPromise;
}

/**
 * board 데이터베이스의 posts 컬렉션을 돌려준다.
 * 모든 API 함수는 DB에 직접 접근하지 않고 이 함수만 호출한다.
 */
export async function getPostsCollection() {
  const client = await clientPromise;
  return client.db('board').collection('posts');
}
