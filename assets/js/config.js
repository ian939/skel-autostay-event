// 카카오맵 JavaScript 키 및 튜닝 상수 — 키 교체는 이 파일 한 곳에서만

/**
 * 카카오 JavaScript 키.
 *
 * 발급: developers.kakao.com > 내 애플리케이션 > 앱 키 > "JavaScript 키"
 *   ※ REST API 키가 아니다. 서로 다른 키다.
 *
 * 도메인 등록(필수): 앱 설정 > 플랫폼 > Web > 사이트 도메인
 *   등록할 값:  https://ian939.github.io
 *              http://localhost:8000
 *   ※ 오리진(스킴+호스트)만 등록한다. 리포 경로(/skel-autostay-event)를
 *     붙이면 매칭에 실패해 sdk.js가 401을 반환하고 지도가 뜨지 않는다.
 *
 * 이 키는 클라이언트에 노출되는 것이 정상이다. 보안은 위 도메인
 * 화이트리스트가 담당하므로, 등록 도메인을 최소로 유지하는 것이 곧 보안이다.
 */
var KAKAO_JS_KEY = 'PASTE_KAKAO_JAVASCRIPT_KEY_HERE';

// 지도 초기 레벨 (setBounds가 대개 덮어쓰지만, bounds 실패 시 폴백으로 쓰인다)
var MAP_DEFAULT_LEVEL = 12;

// 장소 검색 후보 최대 노출 개수
var SEARCH_MAX_RESULTS = 5;

// 지점 선택 시 확대 레벨
var MAP_FOCUS_LEVEL = 4;
