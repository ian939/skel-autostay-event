// 거리 계산 · 거리 표기 · 카카오맵 외부링크 생성 (카카오 SDK 불필요)

// IUGG 평균 지구반경. 분석 프로젝트 scripts/haversine.py와 동일한 값을 쓴다.
// 두 구현이 같은 상수를 쓰지 않으면 리포트 수치와 웹 수치가 미세하게 달라진다.
var R_KM = 6371.0088;

/**
 * 두 좌표 간 대원거리(km). scripts/haversine.py의 이식본.
 * a를 [0,1]로 클립하는 것까지 동일 — 부동소수 오차로 sqrt(1-a)가 NaN이 되는 것을 막는다.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  var rad = function (d) { return d * Math.PI / 180; };
  var p1 = rad(lat1), p2 = rad(lat2);
  var dp = p2 - p1;
  var dl = rad(lng2) - rad(lng1);
  var a = Math.sin(dp / 2) * Math.sin(dp / 2)
        + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  a = Math.min(1, Math.max(0, a));
  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 거리 표기. 구간별로 단위와 자릿수를 바꾼다.
 *   1km 미만  -> "400m"  (10m 단위. "0.4km"보다 읽기 쉽다)
 *   1~10km    -> "3.2km" (소수 1자리)
 *   10km 이상 -> "127km" (정수. "127.3km"는 직선거리에 대한 허위정밀도)
 */
function formatDistance(km) {
  if (km == null || isNaN(km)) return '';
  if (km < 1) return Math.round(km * 100) * 10 + 'm';
  // 9.96처럼 반올림하면 10.0이 되는 값은 소수 표기를 버리고 정수 구간으로 넘긴다.
  // ("10.0km"는 소수 자리가 의미 없고, 아래 정수 표기와 규칙이 어긋난다)
  if (km < 10 && Number(km.toFixed(1)) < 10) return km.toFixed(1) + 'km';
  return Math.round(km) + 'km';
}

// ── 카카오맵 URL 스킴 ────────────────────────────────────────────────
// 형식: 이름,위도,경도 (이름이 먼저, 쉼표 구분, 경로에 들어감)
// 지점명에 공백이 있어(예: "오토스테이 자유로88") encodeURIComponent가 필수다.
// 웹 URL을 쓰면 모바일에서 앱이 있으면 앱으로, 없으면 웹으로 열린다.
// kakaomap:// 커스텀 스킴은 데스크톱에서 막히므로 쓰지 않는다.

function kakaoRouteUrl(store, origin) {
  var to = encodeURIComponent(store.name) + ',' + store.lat + ',' + store.lng;
  if (origin && origin.lat != null && origin.lng != null) {
    var from = encodeURIComponent(origin.label || '내 위치') + ',' + origin.lat + ',' + origin.lng;
    return 'https://map.kakao.com/link/from/' + from + '/to/' + to;
  }
  return 'https://map.kakao.com/link/to/' + to;
}

function kakaoPlaceUrl(store) {
  return 'https://map.kakao.com/link/map/'
       + encodeURIComponent(store.name) + ',' + store.lat + ',' + store.lng;
}
