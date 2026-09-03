# 각 진입 페이지를 CSS·JS·SVG가 모두 인라인된 단일 HTML로 합친다 (앱 웹뷰 배포용)
"""
왜 필요한가:
  앱 웹뷰에 로컬 에셋으로 넣을 때 파일이 여러 개면 경로·번들 설정이 늘어난다.
  단일 HTML이면 assets에 파일 하나만 두고 loadUrl 하면 끝난다.

무엇을 인라인하는가:
  - assets/css/style.css (+ 페이지별 추가 CSS)  -> <style>
  - assets/js/*.js 4개                          -> <script> (config -> stores -> geo -> app 순서)
  - assets/img/pin-*.svg                        -> data URI (JS 안의 경로 문자열을 치환)
  - assets/img/favicon.svg                      -> data URI

무엇을 인라인할 수 없는가 (원격 유지):
  - 카카오맵 SDK (dapi.kakao.com) — 런타임에 타일·검색을 서버에서 받아오므로
    구조적으로 오프라인 불가. 인터넷 연결 필요.
  - Noto Sans KR 웹폰트 — 인라인하면 파일이 수 MB가 된다.
    폰트 로드 실패 시 시스템 한글 폰트로 폴백되므로 원격 유지가 낫다.

사용법:
  python tools/build_single.py            # 전체
  python tools/build_single.py app        # 웹뷰용만
  python tools/build_single.py landing    # 랜딩용만
"""
import base64
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CSS = "assets/css/style.css"
JS_ORDER = [
    "assets/js/config.js",
    "assets/js/stores.js",
    "assets/js/geo.js",
    "assets/js/app.js",
]
PINS = ["pin-direct.svg", "pin-franchise.svg", "pin-selected.svg"]

# 진입 페이지별: (소스 HTML, 추가 CSS 목록, 출력 경로)
PAGES = {
    "landing": ("index.html", [], "dist/index.html"),
    "app": ("app.html", ["assets/css/app-webview.css"], "dist/app.html"),
}


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def svg_data_uri(rel):
    raw = read(rel).strip()
    b64 = base64.b64encode(raw.encode("utf-8")).decode("ascii")
    return "data:image/svg+xml;base64," + b64


def build(page):
    src_html, extra_css, out_rel = PAGES[page]
    html = read(src_html)

    # 1) CSS 인라인. style.css 다음에 페이지별 추가 CSS를 이어 붙여 순서를 보존한다.
    link = '<link rel="stylesheet" href="assets/css/style.css">'
    assert link in html, "CSS link 태그를 찾을 수 없음: " + src_html

    css_parts = [read(CSS).rstrip()]
    for extra in extra_css:
        tag = '<link rel="stylesheet" href="%s">' % extra
        assert tag in html, "추가 CSS link를 찾을 수 없음: " + extra
        html = html.replace("\n" + tag, "").replace(tag, "")
        css_parts.append(
            "/* ===== %s ===== */\n%s" % (os.path.basename(extra), read(extra).rstrip())
        )
    html = html.replace(link, "<style>\n" + "\n\n".join(css_parts) + "\n</style>")

    # 2) 파비콘을 data URI로
    fav = '<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">'
    if fav in html:
        html = html.replace(
            fav,
            '<link rel="icon" href="%s" type="image/svg+xml">'
            % svg_data_uri("assets/img/favicon.svg"),
        )

    # 3) JS 인라인 (순서 유지). 마커 SVG 경로는 data URI로 치환한다.
    pin_uris = {name: svg_data_uri("assets/img/" + name) for name in PINS}

    bundle = []
    for rel in JS_ORDER:
        code = read(rel)
        for name, uri in pin_uris.items():
            code = code.replace("'assets/img/" + name + "'", "'" + uri + "'")
        bundle.append(
            "/* ===== %s ===== */\n%s" % (os.path.basename(rel), code.rstrip())
        )

    for rel in JS_ORDER:
        tag = '<script src="%s"></script>' % rel
        assert tag in html, "script 태그를 찾을 수 없음: " + rel
        html = html.replace("\n" + tag, "", 1)
        html = html.replace(tag, "", 1)

    html = html.replace(
        "</body>", "<script>\n" + "\n\n".join(bundle) + "\n</script>\n</body>"
    )

    # 4) 인라인 누락 검사.
    #    인라인된 <script> 본문에는 JS가 문자열로 조립하는 href=/src= 가 들어 있어
    #    문자열 전체를 훑으면 오탐이 난다. 그래서 "인라인해야 할 파일 경로"가
    #    속성값으로 남아 있는지만 정확히 확인한다.
    must_inline = [CSS] + extra_css + JS_ORDER
    must_inline += ["assets/img/" + n for n in PINS] + ["assets/img/favicon.svg"]
    leftovers = [f for f in must_inline if ('"%s"' % f) in html]
    if leftovers:
        sys.exit("[FAIL] %s: 인라인되지 않은 로컬 참조 %s" % (src_html, leftovers))

    out_abs = os.path.join(ROOT, out_rel)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    with io.open(out_abs, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = len(html.encode("utf-8"))
    print("[OK] %-14s %6.1f KB   <- %s" % (out_rel, size / 1024, src_html))
    return set(re.findall(r'(?:src|href)="(https?://[^"]+)"', html))


def main():
    targets = [a for a in sys.argv[1:] if a in PAGES] or list(PAGES)
    remote = set()
    for page in targets:
        remote |= build(page)

    print()
    print("남은 원격 의존 (인라인 불가):")
    for r in sorted(remote):
        print("  - " + r.split("?")[0])
    print("  - https://dapi.kakao.com/v2/maps/sdk.js   (JS에서 동적 로드)")
    print()
    print("카카오 지도 타일·장소검색은 런타임에 카카오 서버에서 받아오므로")
    print("인터넷 연결이 필요하다. 완전 오프라인 동작은 불가능하다.")


if __name__ == "__main__":
    main()
