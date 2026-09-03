# index.html + CSS + JS + SVG를 하나의 HTML 파일로 합친다 (앱 웹뷰 배포용)
"""
왜 필요한가:
  앱 웹뷰에 로컬 에셋으로 넣을 때 파일이 여러 개면 경로·번들 설정이 늘어난다.
  단일 HTML이면 assets/에 파일 하나만 두고 loadUrl 하면 끝난다.

무엇을 인라인하는가:
  - assets/css/style.css      -> <style>
  - assets/js/*.js (4개)      -> <script> (config -> stores -> geo -> app 순서 유지)
  - assets/img/pin-*.svg      -> data URI (JS 안의 경로 문자열을 치환)
  - assets/img/favicon.svg    -> data URI

무엇을 인라인할 수 없는가 (원격 유지):
  - 카카오맵 SDK (dapi.kakao.com) — 런타임에 타일·검색을 서버에서 받아오므로
    구조적으로 오프라인 불가. 인터넷 연결 필요.
  - Noto Sans KR 웹폰트 — 인라인하면 파일이 수 MB가 된다.
    폰트 로드 실패 시 시스템 한글 폰트로 폴백되므로 원격 유지가 낫다.

출력: dist/index.html (기본) 또는 --out 지정
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


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def svg_data_uri(rel):
    raw = read(rel).strip()
    b64 = base64.b64encode(raw.encode("utf-8")).decode("ascii")
    return "data:image/svg+xml;base64," + b64


def main():
    out_rel = "dist/index.html"
    if "--out" in sys.argv:
        out_rel = sys.argv[sys.argv.index("--out") + 1]

    html = read("index.html")

    # 1) CSS 인라인
    css = read(CSS)
    link = '<link rel="stylesheet" href="assets/css/style.css">'
    assert link in html, "CSS link 태그를 찾을 수 없음"
    html = html.replace(link, "<style>\n" + css.rstrip() + "\n</style>")

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
            # app.js 안의 'assets/img/pin-xxx.svg' 문자열을 data URI로 바꾼다
            code = code.replace("'assets/img/" + name + "'", "'" + uri + "'")
        bundle.append("/* ===== %s ===== */\n%s" % (os.path.basename(rel), code.rstrip()))

    # 개별 script 태그 4개를 제거하고 한 덩어리로 대체
    for rel in JS_ORDER:
        tag = '<script src="%s"></script>' % rel
        assert tag in html, "script 태그를 찾을 수 없음: " + rel
        html = html.replace(tag + "\n", "", 1)
        html = html.replace(tag, "", 1)

    html = html.replace(
        "</body>",
        "<script>\n" + "\n\n".join(bundle) + "\n</script>\n</body>",
    )

    # 4) 인라인 누락 검사.
    #    인라인된 <script> 본문에는 JS가 문자열로 조립하는 href=/src= 가 들어 있어
    #    문자열 스캔으로는 오탐이 난다. 그래서 "우리가 인라인해야 할 파일 경로"가
    #    남아 있는지만 정확히 확인한다.
    must_inline = [CSS] + JS_ORDER + ["assets/img/" + n for n in PINS] +                   ["assets/img/favicon.svg"]
    leftovers = [f for f in must_inline if ('"%s"' % f) in html]
    if leftovers:
        sys.exit("[FAIL] 인라인되지 않은 로컬 참조: %s" % leftovers)

    out_abs = os.path.join(ROOT, out_rel)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    with io.open(out_abs, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = len(html.encode("utf-8"))
    remote = sorted(set(
        re.findall(r'(?:src|href)="(https?://[^"]+)"', html)
    ))
    print("[OK] %s  (%.1f KB, 파일 1개)" % (out_rel, size / 1024))
    print("     남은 원격 의존:")
    for r in remote:
        print("       - " + r.split("?")[0])
    print("     (카카오 SDK는 타일/검색을 서버에서 받으므로 인터넷 연결 필요)")


if __name__ == "__main__":
    main()
