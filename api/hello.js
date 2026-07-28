// Task 3에서 삭제할 임시 파일.
// api/ 폴더에 파일을 두면 Vercel이 자동으로 API 주소를 만들어준다는 것을
// 확인하기 위한 용도다. 이 파일은 /api/hello 주소가 된다.
export default function handler(req, res) {
  res.status(200).json({
    message: '서버리스 함수가 동작합니다',
    method: req.method,
  });
}
