from __future__ import annotations

import html
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Naver-SA-Autopilot-Operator-Feature-Guide.md"
OUTPUT = ROOT / "docs" / "Naver-SA-Autopilot-Operator-Feature-Guide.pptx"

SLIDE_W = 12_192_000
SLIDE_H = 6_858_000
EMU = 914_400

NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"


def emu(inches: float) -> int:
    return int(inches * EMU)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def parse_source() -> list[dict[str, object]]:
    text = SOURCE.read_text(encoding="utf-8")
    sections = re.split(r"(?m)^##\s+", text)
    slides: list[dict[str, object]] = []
    for raw in sections[1:]:
        lines = raw.strip().splitlines()
        if not lines:
            continue
        title = re.sub(r"^\d+\.\s*", "", lines[0].strip())
        body = "\n".join(lines[1:]).strip()
        topic_match = re.search(r"대주제:\s*(.+)", body)
        topic = topic_match.group(1).strip() if topic_match else "Naver SA Autopilot"
        before_features = body.split("### 구현된 기능", 1)[0]
        subtitle_lines = [
            line.strip()
            for line in before_features.splitlines()
            if line.strip() and not line.startswith("대주제:")
        ]
        subtitle = subtitle_lines[0] if subtitle_lines else ""
        features = extract_list(body, "구현된 기능")
        checks = extract_list(body, "운영자가 확인할 점")
        slides.append(
            {
                "title": title,
                "section": topic,
                "subtitle": subtitle,
                "bullets": features,
                "operator": checks,
                "kind": "title" if not slides else "content",
            }
        )
    if not slides:
        raise RuntimeError("No slides parsed from Markdown source.")
    return slides


def extract_list(body: str, heading: str) -> list[str]:
    match = re.search(rf"### {re.escape(heading)}\n(.+?)(?=\n### |\Z)", body, re.S)
    if not match:
        return []
    return [line[2:].strip() for line in match.group(1).splitlines() if line.startswith("- ")]


def color_for_section(section: str) -> str:
    palette = {
        "Naver SA Autopilot": "00A56A",
        "문서 안내": "355C7D",
        "제품 개요": "00A56A",
        "전체 흐름": "257A7B",
        "운영 원칙": "C45A2A",
        "접속과 권한": "4B6FA9",
        "마이페이지": "4B6FA9",
        "작업공간": "157A5A",
        "키워드와 검색어": "2D8C6F",
        "광고 구조 초안": "7A6A2D",
        "예산과 입찰": "8A5A44",
        "운영 근거": "6B7B3B",
        "승인 큐": "B7791F",
        "작업 순서 안내": "257A7B",
        "계정 스캔": "2B6F8F",
        "연결값": "2B6F8F",
        "전송 직전 초안": "5C6BC0",
        "보호 실행": "9B4D3D",
        "저장 이력": "6A5ACD",
        "리포트와 내보내기": "3B7C88",
        "공유 리포트": "3B7C88",
        "관리자": "2D5B87",
        "성과 조회": "5C7F32",
        "보안과 데이터": "6B4E71",
        "검증 체계": "495867",
        "사용자 검수": "8A6D3B",
        "문제 해결": "8A6D3B",
        "용어 정리": "566573",
        "마무리": "00A56A",
    }
    return palette.get(section, "355C7D")


def shape_rect(shape_id: int, x: int, y: int, w: int, h: int, fill: str, line: str | None = None) -> str:
    line_xml = f'<a:solidFill><a:srgbClr val="{line}"/></a:solidFill>' if line else "<a:noFill/>"
    return f"""
      <p:sp>
        <p:nvSpPr><p:cNvPr id="{shape_id}" name="Rect {shape_id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>
          <a:ln>{line_xml}</a:ln>
        </p:spPr>
      </p:sp>"""


def run_xml(text: str, size: int, color: str, bold: bool = False) -> str:
    bold_attr = ' b="1"' if bold else ""
    return (
        f'<a:r><a:rPr lang="ko-KR" sz="{size}"{bold_attr} dirty="0">'
        f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
        '<a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Malgun Gothic"/>'
        f"</a:rPr><a:t>{esc(text)}</a:t></a:r>"
    )


def paragraph_xml(text: str, size: int, color: str, bold: bool = False) -> str:
    return f'<a:p>{run_xml(text, size, color, bold)}<a:endParaRPr lang="ko-KR" sz="{size}"/></a:p>'


def text_box(
    shape_id: int,
    x: int,
    y: int,
    w: int,
    h: int,
    paragraphs: list[str],
    *,
    size: int = 1_450,
    color: str = "1A202C",
    bold: bool = False,
    fill: str | None = None,
    line: str | None = None,
    inset: int = 65_000,
) -> str:
    fill_xml = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else "<a:noFill/>"
    line_xml = f'<a:solidFill><a:srgbClr val="{line}"/></a:solidFill>' if line else "<a:noFill/>"
    paragraphs_xml = "".join(paragraph_xml(p, size, color, bold) for p in paragraphs)
    return f"""
      <p:sp>
        <p:nvSpPr><p:cNvPr id="{shape_id}" name="TextBox {shape_id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          {fill_xml}
          <a:ln>{line_xml}</a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" lIns="{inset}" rIns="{inset}" tIns="{inset}" bIns="{inset}" anchor="t"/>
          <a:lstStyle/>
          {paragraphs_xml}
        </p:txBody>
      </p:sp>"""


def bullet_box(
    shape_id: int,
    x: int,
    y: int,
    w: int,
    h: int,
    title: str,
    bullets: list[str],
    accent: str,
    *,
    body_size: int = 1_370,
) -> str:
    bullet_lines = [f"• {item}" for item in bullets]
    return "".join(
        [
            shape_rect(shape_id, x, y, w, h, "FFFFFF", "D7DEE8"),
            shape_rect(shape_id + 1, x, y, emu(0.08), h, accent),
            text_box(shape_id + 2, x + emu(0.18), y + emu(0.12), w - emu(0.35), emu(0.38), [title], size=1_430, color="0F172A", bold=True),
            text_box(shape_id + 3, x + emu(0.18), y + emu(0.55), w - emu(0.35), h - emu(0.65), bullet_lines, size=body_size, color="263238", inset=35_000),
        ]
    )


def make_slide_xml(index: int, total: int, slide: dict[str, object]) -> str:
    section = str(slide["section"])
    accent = color_for_section(section)
    shapes: list[str] = [
        shape_rect(10, 0, 0, SLIDE_W, SLIDE_H, "F5F7FA"),
        shape_rect(11, 0, 0, emu(0.18), SLIDE_H, accent),
    ]
    shape_id = 12
    title = str(slide["title"])
    subtitle = str(slide["subtitle"])
    bullets = list(slide["bullets"])  # type: ignore[arg-type]
    operator = list(slide["operator"])  # type: ignore[arg-type]

    if slide["kind"] == "title":
        shapes.append(shape_rect(shape_id, emu(0.55), emu(0.62), emu(2.1), emu(0.35), accent))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.68), emu(0.56), emu(4.7), emu(0.52), [section], size=1_250, color="FFFFFF", bold=True))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.65), emu(1.38), emu(11.4), emu(1.2), [title], size=4_200, color="0F172A", bold=True))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.68), emu(2.55), emu(11.2), emu(0.8), [subtitle], size=1_720, color="334155"))
        shape_id += 1
        shapes.append(bullet_box(shape_id, emu(0.72), emu(3.65), emu(6.0), emu(2.25), "문서 범위", bullets, accent, body_size=1_480))
        shape_id += 10
        shapes.append(bullet_box(shape_id, emu(7.0), emu(3.65), emu(5.6), emu(2.25), "운영자 사용 포인트", operator, "2B6F8F", body_size=1_450))
        shape_id += 10
    else:
        shapes.append(shape_rect(shape_id, emu(0.55), emu(0.35), emu(1.8), emu(0.28), accent))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.68), emu(0.27), emu(3.7), emu(0.43), [section], size=1_050, color="FFFFFF", bold=True))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.6), emu(0.82), emu(11.7), emu(0.72), [title], size=2_760, color="0F172A", bold=True))
        shape_id += 1
        shapes.append(text_box(shape_id, emu(0.62), emu(1.52), emu(11.4), emu(0.55), [subtitle], size=1_290, color="475569"))
        shape_id += 1
        body_size = 1_285 if len(bullets) >= 5 else 1_365
        shapes.append(bullet_box(shape_id, emu(0.65), emu(2.23), emu(7.05), emu(3.92), "구현된 기능", bullets, accent, body_size=body_size))
        shape_id += 10
        shapes.append(bullet_box(shape_id, emu(7.95), emu(2.23), emu(4.25), emu(3.92), "운영자가 확인할 점", operator, "334155", body_size=1_300))
        shape_id += 10

    shapes.append(text_box(shape_id, emu(0.65), emu(6.35), emu(6.4), emu(0.28), [f"Naver SA Autopilot Operator Guide | {index}/{total}"], size=850, color="64748B"))
    shape_id += 1
    shapes.append(text_box(shape_id, emu(9.2), emu(6.35), emu(3.0), emu(0.28), ["라이브 집행 금지 · 삭제 금지"], size=850, color="9B4D3D", bold=True))
    sp_tree = f"""
        <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
        {''.join(shapes)}
    """
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="{NS_A}" xmlns:r="{NS_R}" xmlns:p="{NS_P}">
  <p:cSld><p:spTree>{sp_tree}</p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""


THEME_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="{NS_A}" name="Naver SA Operator Theme">
  <a:themeElements>
    <a:clrScheme name="NaverSA"><a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F5F7FA"/></a:lt2><a:accent1><a:srgbClr val="00A56A"/></a:accent1><a:accent2><a:srgbClr val="2B6F8F"/></a:accent2><a:accent3><a:srgbClr val="B7791F"/></a:accent3><a:accent4><a:srgbClr val="6A5ACD"/></a:accent4><a:accent5><a:srgbClr val="9B4D3D"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Malgun"><a:majorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Malgun Gothic"/></a:majorFont><a:minorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Malgun Gothic"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="NaverSA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>"""

SLIDE_MASTER_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="{NS_A}" xmlns:r="{NS_R}" xmlns:p="{NS_P}">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>"""

SLIDE_LAYOUT_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="{NS_A}" xmlns:r="{NS_R}" xmlns:p="{NS_P}" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

MASTER_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>"""

LAYOUT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"""


def presentation_xml(slides: list[dict[str, object]]) -> str:
    ids = "".join(f'<p:sldId id="{255 + i}" r:id="rId{i + 1}"/>' for i in range(1, len(slides) + 1))
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="{NS_A}" xmlns:r="{NS_R}" xmlns:p="{NS_P}" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>{ids}</p:sldIdLst>
  <p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/>
</p:presentation>"""


def presentation_rels(slides: list[dict[str, object]]) -> str:
    rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>']
    rels.extend(
        f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
        for i in range(1, len(slides) + 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(rels)}</Relationships>"""


def content_types(slides: list[dict[str, object]]) -> str:
    overrides = [
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    ]
    overrides.extend(
        f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(1, len(slides) + 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  {''.join(overrides)}
</Types>"""


def slide_rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>"""


def app_xml(slides: list[dict[str, object]]) -> str:
    titles = "".join(f'<vt:lpstr>{esc(slide["title"])}</vt:lpstr>' for slide in slides)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>{len(slides)}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Slides</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(slides)}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="{len(slides)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts><Company>Naver SA Autopilot</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion>
</Properties>"""


def core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Naver SA Autopilot 운영자 기능 설명서</dc:title><dc:subject>Operator feature guide</dc:subject><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


def write_pptx(slides: list[dict[str, object]]) -> None:
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as pptx:
        pptx.writestr("[Content_Types].xml", content_types(slides))
        pptx.writestr("_rels/.rels", ROOT_RELS)
        pptx.writestr("docProps/app.xml", app_xml(slides))
        pptx.writestr("docProps/core.xml", core_xml())
        pptx.writestr("ppt/presentation.xml", presentation_xml(slides))
        pptx.writestr("ppt/_rels/presentation.xml.rels", presentation_rels(slides))
        pptx.writestr("ppt/theme/theme1.xml", THEME_XML)
        pptx.writestr("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER_XML)
        pptx.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", MASTER_RELS)
        pptx.writestr("ppt/slideLayouts/slideLayout1.xml", SLIDE_LAYOUT_XML)
        pptx.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", LAYOUT_RELS)
        for index, slide in enumerate(slides, start=1):
            pptx.writestr(f"ppt/slides/slide{index}.xml", make_slide_xml(index, len(slides), slide))
            pptx.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", slide_rels())


def validate_pptx() -> None:
    with zipfile.ZipFile(OUTPUT, "r") as pptx:
        bad_member = pptx.testzip()
        if bad_member:
            raise RuntimeError(f"Bad zip member: {bad_member}")
        for name in pptx.namelist():
            if name.endswith(".xml"):
                ET.fromstring(pptx.read(name))


def main() -> None:
    slides = parse_source()
    write_pptx(slides)
    validate_pptx()
    print(f"Created {OUTPUT}")
    print(f"Slides: {len(slides)}")


if __name__ == "__main__":
    main()
