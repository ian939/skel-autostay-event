// 지점 찾기 앱 — 상태 모델 · 렌더링 · 카카오 지도 · 내 위치 · 장소 검색

(function () {
  'use strict';

  // ── 상태 ─────────────────────────────────────────────
  // 단일 상태 객체 + render()로 통일한다. DOM을 직접 만지면
  // 리스트와 지도가 서로 다른 것을 가리키는 버그가 생긴다.
  var state = {
    origin: null,      // { lat, lng, label } — 내 위치 또는 검색 장소
    group: 'all',      // 지역 필터
    selectedId: null,  // 선택된 지점 id
    sorted: []         // STORES + distKm, 정렬 완료
  };

  var GROUPS = [
    { key: 'all',    label: '전체' },
    { key: 'goyang', label: '고양·파주' },
    { key: 'seoul',  label: '서울·광명' },
    { key: 'north',  label: '양주·하남' },
    { key: 'south',  label: '경기 남부' },
    { key: 'daegu',  label: '대구·구미' }
  ];

  // 카카오 객체 (지도 없이도 앱이 동작해야 하므로 전부 null 허용)
  var map = null, overlay = null, myMarker = null;
  var markers = {};   // id -> kakao.maps.Marker
  var rowEls = {};    // id -> HTMLElement
  var PIN = null;
  var mapReady = false;

  var $ = function (id) { return document.getElementById(id); };
  var el = {};

  // ── 유틸 ─────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function badgeClass(type) { return type === '직영' ? 'badge--direct' : 'badge--fr'; }

  function setStatus(msg, kind) {
    el.status.textContent = msg || '';
    el.status.className = 'status' + (msg ? ' is-' + (kind || 'ok') : '');
  }

  // ── 정렬 · 필터 ───────────────────────────────────────
  function recompute() {
    var o = state.origin;
    state.sorted = STORES.map(function (s) {
      var copy = {};
      for (var k in s) copy[k] = s[k];
      copy.distKm = o ? haversineKm(o.lat, o.lng, s.lat, s.lng) : null;
      return copy;
    });

    state.sorted.sort(function (a, b) {
      if (o) return a.distKm - b.distKm;
      // 기준점이 없으면 수도권 우선 → 지역명 → no
      if (a.zone !== b.zone) return a.zone === '수도권' ? -1 : 1;
      if (a.region !== b.region) return a.region.localeCompare(b.region, 'ko');
      return a.no - b.no;
    });
  }

  function visibleStores() {
    if (state.group === 'all') return state.sorted;
    return state.sorted.filter(function (s) { return s.group === state.group; });
  }

  function isVisible(store) {
    return state.group === 'all' || store.group === state.group;
  }

  // ── 렌더 ─────────────────────────────────────────────
  function render() {
    recompute();
    renderRecommend();
    renderChips();
    renderList();
    syncMarkers();
    syncUrl();
  }

  // 추천 카드는 필터를 무시하고 항상 "전체 중 가장 가까운" 지점을 보여준다.
  // 고양에 있는 사용자가 대구 필터를 눌렀을 때 추천이 대구로 바뀌면 의미가 없다.
  function renderRecommend() {
    if (!state.origin) { el.recommend.hidden = true; el.recommend.innerHTML = ''; return; }
    var top = state.sorted[0];
    if (!top) { el.recommend.hidden = true; return; }

    el.recommend.hidden = false;
    el.recommend.innerHTML =
      '<p class="recommend__tag">' + esc(state.origin.label) + ' 기준 · 가장 가까운 지점</p>' +
      '<p class="recommend__name">' + esc(top.name) + '</p>' +
      '<p class="recommend__meta">' + esc(top.addr) + '<br>' + esc(top.hours) +
        ' · <span class="badge ' + badgeClass(top.type) + '">' + esc(top.type) + '</span></p>' +
      '<p class="recommend__dist">직선거리 <b>' + formatDistance(top.distKm) + '</b></p>' +
      '<p class="recommend__note">직선거리 기준이며 실제 이동거리·소요시간과 다를 수 있습니다.</p>' +
      '<div class="recommend__acts">' +
        '<a class="btn btn--primary" href="' + kakaoRouteUrl(top, state.origin) +
          '" target="_blank" rel="noopener">길찾기</a>' +
        '<button type="button" class="btn btn--ghost" data-focus="' + top.id + '">지도에서 보기</button>' +
      '</div>';
  }

  function renderChips() {
    if (el.chips.childElementCount) {   // 1회만 생성하고 이후 상태만 갱신
      Array.prototype.forEach.call(el.chips.children, function (b) {
        b.setAttribute('aria-selected', String(b.dataset.group === state.group));
      });
      return;
    }
    GROUPS.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.group = g.key;
      b.textContent = g.label;
      b.setAttribute('aria-selected', String(g.key === state.group));
      el.chips.appendChild(b);
    });
  }

  function renderList() {
    var list = visibleStores();
    var gLabel = GROUPS.filter(function (g) { return g.key === state.group; })[0].label;

    el.listTitle.textContent = state.group === 'all'
      ? '참여 지점 ' + list.length + '곳'
      : gLabel + ' ' + list.length + '곳';

    rowEls = {};
    el.list.innerHTML = '';

    if (!list.length) {
      var p = document.createElement('li');
      p.className = 'empty';
      p.textContent = '선택한 지역에 참여 지점이 없습니다.\n다른 지역을 선택해 주세요.';
      el.list.appendChild(p);
      return;
    }

    list.forEach(function (s) {
      var li = document.createElement('li');
      var dist = s.distKm != null
        ? '<span class="badge badge--dist">' + formatDistance(s.distKm) + '</span>' : '';

      li.innerHTML =
        '<button type="button" class="store-item' +
          (s.id === state.selectedId ? ' is-selected' : '') + '" data-id="' + s.id + '">' +
          '<span class="store-item__top">' +
            '<span class="store-item__name">' + esc(s.name) + '</span>' +
            '<span class="badge ' + badgeClass(s.type) + '">' + esc(s.type) + '</span>' +
            dist +
          '</span>' +
          '<span class="store-item__addr">' + esc(s.addr) +
            '<br><span class="hours">' + esc(s.hours) + '</span></span>' +
          '<span class="store-item__foot">' +
            '<span class="store-item__link" data-route="' + s.id + '">길찾기</span>' +
          '</span>' +
        '</button>';

      el.list.appendChild(li);
      rowEls[s.id] = li.firstChild;
    });
  }

  // ?store=id 를 유지해 특정 지점 딥링크 공유가 가능하게 한다
  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    var u = new URL(location.href);
    if (state.selectedId) u.searchParams.set('store', state.selectedId);
    else u.searchParams.delete('store');
    history.replaceState(null, '', u.toString());
  }

  // ── 선택 ─────────────────────────────────────────────
  function select(id, opts) {
    opts = opts || {};
    state.selectedId = id;

    var store = null;
    for (var i = 0; i < STORES.length; i++) if (STORES[i].id === id) store = STORES[i];

    // 선택한 지점이 현재 필터 밖이면 필터를 전체로 되돌린다 (핀은 숨었는데 선택된 상태 방지)
    if (store && !isVisible(store)) state.group = 'all';

    render();

    if (store && opts.pan && mapReady) {
      // setLevel(anchor) + panTo를 같이 부르면 애니메이션 pan이 확대를 가로채
      // 배율은 그대로인 채 위치만 어긋난다. 중심과 레벨을 한 번에 확정한다.
      var pos = new kakao.maps.LatLng(store.lat, store.lng);
      map.setLevel(MAP_FOCUS_LEVEL);
      map.setCenter(pos);
      // 지도 컨테이너 상단이 화면 밖으로 밀려 있으면 컨테이너 중앙 = 화면 밖이 된다.
      // 잘려나간 만큼 지도를 되돌려 핀이 보이는 영역 가운데 오게 한다.
      var box = el.map.getBoundingClientRect();
      var hidden = Math.max(0, -box.top);
      if (hidden > 8) {
        var pt = map.getProjection().containerPointFromCoords(pos);
        pt.y += hidden / 2;
        map.setCenter(map.getProjection().coordsFromContainerPoint(pt));
      }
    }
    if (opts.scroll !== false) {
      // render()가 리스트를 새로 만들었으므로 다음 프레임에 측정한다.
      // 즉시 측정하면 교체 전 노드의 좌표를 읽어 스크롤이 어긋난다.
      var rid = id;
      requestAnimationFrame(function () {
        var row = rowEls[rid];
        if (row) revealRow(row);
      });
    }
  }

  // 고정된 지도(.map-col) 높이만큼 오프셋을 두고 행을 노출한다.
  // scrollIntoView는 sticky 요소를 모르기 때문에 그냥 쓰면 행이 지도 아래에 가린다.
  function revealRow(row) {
    var r = row.getBoundingClientRect();
    var col = document.querySelector('.map-col');
    var stuck = col ? col.getBoundingClientRect() : null;
    var top = stuck && stuck.top <= 1 ? stuck.bottom : 0;   // 지도가 붙어 있을 때만 보정
    var gap = 12;
    if (r.top < top + gap) {
      window.scrollBy({ top: r.top - top - gap, behavior: 'smooth' });
    } else if (r.bottom > window.innerHeight - 84) {         // 하단 고정 CTA 바 여유
      window.scrollBy({ top: r.bottom - window.innerHeight + 84, behavior: 'smooth' });
    }
  }

  // ── 지도 ─────────────────────────────────────────────
  function showMapError(code) {
    var msgs = {
      NO_KEY: '지도 준비 중입니다.\n지점 목록은 아래에서 확인하실 수 있습니다.',
      SDK_FAILED: '지도를 불러올 수 없습니다.\n지점 목록은 아래에서 확인하실 수 있습니다.',
      NO_SERVICES: '지도 검색 기능을 불러올 수 없습니다.',
      TIMEOUT: '지도 로딩이 지연되고 있습니다.\n네트워크를 확인해 주세요.'
    };
    el.map.innerHTML = '<div class="map-fallback"><p>' +
      esc(msgs[code] || '지도 오류') + '</p></div>';
    document.body.classList.add('no-map');
    // 지도가 없어도 내 위치·검색·정렬은 그대로 동작한다 (검색만 SDK 의존)
    if (code === 'NO_KEY' || code === 'SDK_FAILED' || code === 'TIMEOUT') {
      el.q.disabled = true;
      el.q.placeholder = '지도 준비 후 검색 가능';
    }
  }

  function loadKakaoSdk() {
    return new Promise(function (resolve, reject) {
      if (!KAKAO_JS_KEY || KAKAO_JS_KEY.indexOf('PASTE_') === 0) return reject('NO_KEY');
      var done = false;
      var t = setTimeout(function () { if (!done) reject('TIMEOUT'); }, 10000);
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(KAKAO_JS_KEY) +
              '&libraries=services&autoload=false';
      s.onerror = function () { done = true; clearTimeout(t); reject('SDK_FAILED'); };
      s.onload = function () {
        if (!window.kakao || !kakao.maps) { done = true; clearTimeout(t); return reject('SDK_FAILED'); }
        kakao.maps.load(function () {
          done = true; clearTimeout(t);
          if (!kakao.maps.services) return reject('NO_SERVICES');
          resolve();
        });
      };
      document.head.appendChild(s);
    });
  }

  function initMap() {
    map = new kakao.maps.Map(el.map, {
      center: new kakao.maps.LatLng(37.5665, 126.9780),
      level: MAP_DEFAULT_LEVEL
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    // MarkerImage는 2개만 만들어 전 마커가 공유한다. offset은 핀 끝(bottom-center).
    PIN = {
      '직영': new kakao.maps.MarkerImage('assets/img/pin-direct.svg',
        new kakao.maps.Size(34, 44), { offset: new kakao.maps.Point(17, 44) }),
      '가맹': new kakao.maps.MarkerImage('assets/img/pin-franchise.svg',
        new kakao.maps.Size(34, 44), { offset: new kakao.maps.Point(17, 44) }),
      selected: new kakao.maps.MarkerImage('assets/img/pin-selected.svg',
        new kakao.maps.Size(46, 58), { offset: new kakao.maps.Point(23, 58) })
    };

    // 오버레이는 인스턴스 1개를 재사용한다 (15개 생성 금지)
    overlay = new kakao.maps.CustomOverlay({ yAnchor: 1.62, zIndex: 20 });

    STORES.forEach(function (s) {
      var mk = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(s.lat, s.lng),
        image: PIN[s.type],
        title: s.name
      });
      kakao.maps.event.addListener(mk, 'click', function () {
        // 마커 클릭 시엔 지도를 움직이지 않는다 (손가락 아래에서 화면이 움직이면 혼란)
        select(s.id, { pan: false });
      });
      markers[s.id] = mk;
    });

    mapReady = true;
    fitTo(visibleStores());
    syncMarkers();

    var t;
    function relayout() {
      clearTimeout(t);
      t = setTimeout(function () {
        map.relayout();
        fitTo(visibleStores());
      }, 150);
    }
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);

    // 지도가 화면 밖(스크롤 아래)에 있으면 카카오가 컨테이너 크기를 0으로 보고
    // setBounds가 조용히 실패한다. 처음 화면에 들어오는 순간 relayout + 재fit 한다.
    // (실제로 이 처리가 없으면 지도가 세계지도 좌상단을 보여준다)
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            map.relayout();
            fitTo(visibleStores());
            io.disconnect();
            break;
          }
        }
      }, { threshold: 0.01 });
      io.observe(el.map);
    }
  }

  function fitTo(list) {
    if (!mapReady || !list.length) return;
    var b = new kakao.maps.LatLngBounds();
    list.forEach(function (s) { b.extend(new kakao.maps.LatLng(s.lat, s.lng)); });
    if (state.origin) b.extend(new kakao.maps.LatLng(state.origin.lat, state.origin.lng));
    // 패딩이 없으면 외곽 핀이 뷰포트 경계에 붙는다
    map.setBounds(b, 48, 48, 48, 48);
  }

  function syncMarkers() {
    if (!mapReady) return;
    STORES.forEach(function (s) {
      var mk = markers[s.id];
      var vis = isVisible(s);
      mk.setMap(vis ? map : null);
      mk.setImage(s.id === state.selectedId ? PIN.selected : PIN[s.type]);
      mk.setZIndex(s.id === state.selectedId ? 30 : 10);
    });

    var sel = null;
    for (var i = 0; i < STORES.length; i++) if (STORES[i].id === state.selectedId) sel = STORES[i];

    // 마커를 숨겨도 CustomOverlay는 남는다 → 명시적으로 닫는다
    if (sel && isVisible(sel)) {
      var d = state.sorted.filter(function (x) { return x.id === sel.id; })[0];
      var dist = d && d.distKm != null ? ' · 직선거리 ' + formatDistance(d.distKm) : '';
      overlay.setContent(
        '<div style="padding:10px 14px;background:#1D1D1F;color:#fff;border-radius:12px;' +
        'font:700 13px/1.4 \'Noto Sans KR\',sans-serif;letter-spacing:-.02em;white-space:nowrap;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.25)">' + esc(sel.name) +
        '<span style="display:block;margin-top:3px;font-weight:400;font-size:11px;color:#A1A1A6">' +
        esc(sel.hours) + dist + '</span></div>'
      );
      overlay.setPosition(new kakao.maps.LatLng(sel.lat, sel.lng));
      overlay.setMap(map);
    } else {
      overlay.setMap(null);
    }
  }

  function showMyLocation() {
    if (!mapReady || !state.origin) return;
    var pos = new kakao.maps.LatLng(state.origin.lat, state.origin.lng);
    if (!myMarker) {
      myMarker = new kakao.maps.CustomOverlay({
        position: pos, zIndex: 25, yAnchor: 0.5, xAnchor: 0.5,
        content: '<div style="width:16px;height:16px;border-radius:50%;background:#0071E3;' +
                 'border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,113,227,.25)"></div>'
      });
    }
    myMarker.setPosition(pos);
    myMarker.setMap(map);
  }

  // ── 기준점 설정 ───────────────────────────────────────
  function setOrigin(lat, lng, label) {
    state.origin = { lat: lat, lng: lng, label: label };
    state.selectedId = null;
    clearCandidates();
    render();
    showMyLocation();
    fitTo(visibleStores());
    setStatus(label + ' 기준으로 가까운 지점을 정렬했습니다.', 'ok');
  }

  // ── 내 위치 ───────────────────────────────────────────
  function locate() {
    if (!navigator.geolocation) {
      setStatus('이 브라우저는 위치 기능을 지원하지 않습니다. 지역명으로 검색해 주세요.', 'err');
      return;
    }
    var btn = el.locate, label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '위치 확인 중...';
    setStatus('');

    function restore() { btn.disabled = false; btn.innerHTML = label; }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        restore();
        setOrigin(pos.coords.latitude, pos.coords.longitude, '현재 위치');
      },
      function (err) {
        restore();
        // 위치 거부는 사이트별로 기억되어 재요청이 안 된다 → 검색으로 유도한다
        var m = {
          1: '내 위치가 보이지 않을 경우, 브라우저 설정 > 위치를 허용해 주세요.\n또는 아래 검색창에 지역명을 입력해 주세요.',
          2: '위치를 확인할 수 없습니다. 지역명으로 검색해 주세요.',
          3: '위치 확인이 지연됩니다. 지역명으로 검색해 주세요.'
        };
        setStatus(m[err.code] || '위치 확인에 실패했습니다. 지역명으로 검색해 주세요.', 'err');
        if (!el.q.disabled) el.q.focus();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  // ── 장소 검색 ─────────────────────────────────────────
  function clearCandidates() {
    el.candidates.hidden = true;
    el.candidates.innerHTML = '';
  }

  function showCandidates(items, q) {
    if (items.length === 1) {   // 결과가 하나면 바로 적용
      setOrigin(items[0].lat, items[0].lng, items[0].label);
      return;
    }
    // 여러 결과를 조용히 하나로 골라버리면 엉뚱한 지점을 추천하게 된다 → 사용자가 고른다
    el.candidates.innerHTML = '';
    items.slice(0, SEARCH_MAX_RESULTS).forEach(function (it) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<b>' + esc(it.label) + '</b><span>' + esc(it.sub || '') + '</span>';
      b.addEventListener('click', function () { setOrigin(it.lat, it.lng, it.label); });
      li.appendChild(b);
      el.candidates.appendChild(li);
    });
    el.candidates.hidden = false;
    setStatus('\'' + q + '\' 검색 결과입니다. 기준이 될 장소를 선택해 주세요.', 'ok');
  }

  function search(q) {
    q = (q || '').trim();
    if (!q) return;
    if (!mapReady || !kakao.maps.services) {
      setStatus('검색 기능을 사용할 수 없습니다. 내 위치로 찾기를 이용해 주세요.', 'err');
      return;
    }
    setStatus('검색 중...', 'ok');
    clearCandidates();

    var S = kakao.maps.services.Status;

    // 카카오는 x=경도, y=위도를 문자열로 반환한다. LatLng는 (위도, 경도) 순.
    new kakao.maps.services.Places().keywordSearch(q, function (data, status) {
      if (status === S.OK && data.length) {
        return showCandidates(data.map(function (d) {
          return {
            label: d.place_name,
            sub: d.road_address_name || d.address_name,
            lat: parseFloat(d.y), lng: parseFloat(d.x)
          };
        }), q);
      }
      // 키워드가 0건이면 주소 검색으로 폴백 ("원효로 1가" 같은 입력)
      new kakao.maps.services.Geocoder().addressSearch(q, function (res, st2) {
        if (st2 === S.OK && res.length) {
          return showCandidates(res.map(function (r) {
            return {
              label: r.road_address ? r.road_address.address_name : r.address_name,
              sub: r.address_name,
              lat: parseFloat(r.y), lng: parseFloat(r.x)
            };
          }), q);
        }
        if (st2 === S.ZERO_RESULT) {
          setStatus('검색어와 일치하는 장소가 없습니다.\n지역명이나 도로명 주소로 다시 시도해 주세요.', 'warn');
        } else {
          setStatus('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'err');
        }
      });
    }, { size: 10 });
  }

  // ── 이벤트 배선 ───────────────────────────────────────
  function wire() {
    el.locate.addEventListener('click', locate);

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      search(el.q.value);
    });

    // 위임: 리스트를 다시 그려도 리스너가 살아 있다
    el.list.addEventListener('click', function (e) {
      var route = e.target.closest('[data-route]');
      if (route) {
        e.preventDefault();
        var rid = route.dataset.route, rs = null;
        for (var i = 0; i < STORES.length; i++) if (STORES[i].id === rid) rs = STORES[i];
        if (rs) window.open(kakaoRouteUrl(rs, state.origin), '_blank', 'noopener');
        return;
      }
      var item = e.target.closest('[data-id]');
      if (item) select(item.dataset.id, { pan: true, scroll: false });
    });

    el.chips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-group]');
      if (!b) return;
      state.group = b.dataset.group;
      var sel = null;
      for (var i = 0; i < STORES.length; i++) if (STORES[i].id === state.selectedId) sel = STORES[i];
      if (sel && !isVisible(sel)) state.selectedId = null;
      render();
      fitTo(visibleStores());
    });

    el.recommend.addEventListener('click', function (e) {
      var f = e.target.closest('[data-focus]');
      if (f) select(f.dataset.focus, { pan: true });
    });

    // 미확정 링크는 클릭을 막고 무엇이 필요한지 알린다
    Array.prototype.forEach.call(document.querySelectorAll('.todo-link'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        alert('아직 연결되지 않은 링크입니다: ' + a.dataset.todo);
      });
    });
  }

  // ── 시작 ─────────────────────────────────────────────
  function start() {
    el = {
      map: $('map'), list: $('list'), listTitle: $('list-title'),
      chips: $('chips'), recommend: $('recommend'), status: $('status'),
      candidates: $('candidates'), locate: $('btn-locate'),
      form: $('search-form'), q: $('q')
    };

    wire();
    render();   // 지도·위치를 기다리지 않고 리스트를 먼저 그린다

    var want = new URL(location.href).searchParams.get('store');

    loadKakaoSdk().then(function () {
      initMap();
      if (want) select(want, { pan: true });
      else render();
    }).catch(function (code) {
      showMapError(typeof code === 'string' ? code : 'SDK_FAILED');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
