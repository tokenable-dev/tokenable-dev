/** Swagger UI 기본 영문 라벨 → 한글 (API 경로·메서드명은 유지) */
(function () {
  var MAP = [
    ['Explore', '탐색'],
    ['Try it out', '실행해 보기'],
    ['Cancel', '취소'],
    ['Execute', '실행'],
    ['Clear', '지우기'],
    ['Parameters', '파라미터'],
    ['No parameters', '파라미터 없음'],
    ['Request body', '요청 본문'],
    ['Responses', '응답'],
    ['Response body', '응답 본문'],
    ['Response headers', '응답 헤더'],
    ['Server response', '서버 응답'],
    ['Links', '링크'],
    ['Authorize', '인증'],
    ['Close', '닫기'],
    ['Available authorizations', '사용 가능한 인증'],
    ['Apply', '적용'],
    ['Logout', '로그아웃'],
    ['Authorized', '인증됨'],
    ['Copy', '복사'],
    ['Download', '다운로드'],
    ['Request URL', '요청 URL'],
    ['Loading...', '로딩 중...'],
    ['Filter by tag', '태그로 필터'],
    ['Example Value', '예시 값'],
    ['Schema', '스키마'],
    ['Models', '모델'],
    ['Schemas', '스키마'],
    ['Required', '필수'],
    ['Name', '이름'],
    ['Description', '설명'],
    ['default', '기본'],
    ['Model', '모델'],
    ['Media type', '미디어 타입'],
    ['Controls Accept header.', 'Accept 헤더를 제어합니다.'],
    ['Headers', '헤더'],
    ['Path', '경로'],
    ['Query', '쿼리'],
    ['Body', '본문'],
    ['Response', '응답'],
    ['Code', '코드'],
    ['Details', '상세'],
    ['Curl', 'cURL'],
    ['Request samples', '요청 샘플'],
    ['Response samples', '응답 샘플'],
    ['No links', '링크 없음'],
    ['Operations', 'API'],
    ['Find out more', '자세히 보기'],
    ['Value', '값'],
    ['Type', '타입'],
    ['Format', '형식'],
    ['Enum', '열거'],
    ['Array of', '배열'],
    ['object', '객체'],
    ['string', '문자열'],
    ['integer', '정수'],
    ['number', '숫자'],
    ['boolean', '불리언'],
  ];

  function replaceText(text) {
    if (!text) return text;
    var out = text;
    for (var i = 0; i < MAP.length; i++) {
      if (out === MAP[i][0]) return MAP[i][1];
      if (out.indexOf(MAP[i][0]) !== -1) {
        out = out.split(MAP[i][0]).join(MAP[i][1]);
      }
    }
    return out;
  }

  function translateRoot(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll(
      'button, label, th, h4, h3, h2, span, a, p, .opblock-summary-description, .response-col_status, .tab li',
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length > 0) continue;
      var t = el.textContent;
      if (!t || !t.trim()) continue;
      var next = replaceText(t.trim());
      if (next !== t.trim()) el.textContent = next;
    }
    var inputs = root.querySelectorAll('[placeholder]');
    for (var j = 0; j < inputs.length; j++) {
      var p = inputs[j].getAttribute('placeholder');
      var np = replaceText(p);
      if (np !== p) inputs[j].setAttribute('placeholder', np);
    }
  }

  function run() {
    translateRoot(document.body);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  new MutationObserver(function () {
    run();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
