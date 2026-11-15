"""Build the RAG knowledge base from the Word files in the project root.

Design rules:
  * No summarisation: every chunk is the original text, verbatim (only whitespace / boilerplate cleaned).
  * Chunks follow the document structure (bold headings) - never cut mid-sentence.
  * Each chunk carries: hazard, heading path, content type, source URL, tagged NASA risks.
  * Podcast transcripts are chunked on speaker turns; video transcripts kept with timestamps.
  * Repeated boilerplate and passages duplicated across files are removed (first occurrence kept).

Usage (from backend/):  .venv/Scripts/python scripts/build_kb.py
Input:  knowledge-base/sources/docx/*.docx
Output: knowledge-base/processed/chunks.jsonl, processed/review/*.md, processed/stats.md
"""
import hashlib, json, re, sys
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

PROJECT = Path(__file__).resolve().parents[2]
SRC = PROJECT / "knowledge-base" / "sources" / "docx"
OUT = PROJECT / "knowledge-base" / "processed"
RISKS = json.loads((Path(__file__).with_name("risk_map.json")).read_text(encoding="utf-8"))["risks"]

HAZARD_NAMES = {
    "space_radiation": "Space Radiation",
    "isolation_confinement": "Isolation and Confinement",
    "distance_from_earth": "Distance from Earth",
    "gravity_fields": "Gravity Fields",
    "hostile_closed_environments": "Hostile/Closed Environments",
    "cross_hazard": "Cross-hazard (risks & research)",
}
HAZARDS_URL = "https://www.nasa.gov/hrp/hazards/"
DOCS = [  # file, doc id, default hazard (None = derive from risk tags), fallback source page
    ("Knowledge base Space radiation..docx", "space-radiation", "space_radiation", HAZARDS_URL),
    ("isolation-confinement-knowledge-base.docx", "isolation-confinement", "isolation_confinement", HAZARDS_URL),
    ("distance from the earth..docx", "distance-from-earth", "distance_from_earth", HAZARDS_URL),
    ("Gravity-field-knowledge-base.docx", "gravity-fields", "gravity_fields", HAZARDS_URL),
    ("Hostileclosedenvironments.docx", "hostile-closed-environments", "hostile_closed_environments", HAZARDS_URL),
    ("Risks of Human Spaceflight.docx", "risks", None, "https://www.nasa.gov/hrp/risks/"),
    ("Ongoing HRP Research in Space.docx", "ongoing-research", None, "https://www.nasa.gov/hrp/ongoing-hrp-research/"),
]

SUB_HEADINGS = {"what are the top risks?", "what can be done about it?", "did you know?", "description",
                "impact", "top risks addressed", "top risk addressed", "transcript"}
DROP_LINE = re.compile(r"^(_{2,}|\[ ?music ?\]|research in support of this risk:.*|explore more:.*|"
                       r"got a question for future hera crew members\?.*|learn more about .*:)$", re.I)
BOILERPLATE_PREFIX = ("nasa's human research program, or hrp, pursues the best methods",)
GENERIC_URL = re.compile(r"nasa\.gov/(hrp|international-space-station|humans-in-space)/?$|nasa\.gov/?$")
TARGET_WORDS, MAX_WORDS, MIN_WORDS = 380, 520, 70
SPEAKER = re.compile(r"^([A-Z][\w.' \-]{1,40}?(?: \([^)]{1,30}\))?):\s*(.*)$", re.S)


def clean(t: str) -> str:
    t = t.replace("\xa0", " ").replace("\u200b", "")
    t = re.sub(r"\[ ?Music ?\]", "", t, flags=re.I)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()


def para_links(p):
    urls = []
    for h in p._p.iter(qn("w:hyperlink")):
        rid = h.get(qn("r:id"))
        if rid and rid in p.part.rels:
            urls.append(p.part.rels[rid].target_ref)
    return urls


def is_bold_heading(p, text):
    runs = [r for r in p.runs if r.text.strip()]
    if not runs or len(text.split()) > 25:
        return False
    return all(r.bold or (r.font is not None and r.font.bold) for r in runs)


def slug_words(s):
    return set(w for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) > 2)


def norm_key(t):
    return hashlib.md5(re.sub(r"\W+", " ", t.lower()).strip().encode()).hexdigest()


def tag_risks(text, heading):
    found = []
    low, hlow = text.lower(), heading.lower()
    for rid, r in RISKS.items():
        hits, in_head = 0, False
        for kw in r["keywords"]:
            pat = r"\b" + re.escape(kw) + (r"s?\b" if len(kw) <= 4 else "")
            hits += len(re.findall(pat, low))
            in_head |= bool(re.search(pat, hlow))
        if r["name"].lower() in low or r["name"].lower() in hlow:
            in_head = True
        if in_head or hits >= 2:
            found.append(rid)
    return found


def split_sentences(text, max_words):
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'“])", text)
    out, cur = [], []
    for s in sents:
        if cur and len(" ".join(cur + [s]).split()) > max_words:
            out.append(" ".join(cur)); cur = []
        cur.append(s)
    if cur: out.append(" ".join(cur))
    return out


# ---------------------------------------------------------------- parse
def parse_doc(path):
    """Yield blocks: dict(kind=heading|para, text, links, bold)."""
    d = Document(path)
    for p in d.paragraphs:
        raw = p.text
        if not raw.strip():
            continue
        links = para_links(p)
        if is_bold_heading(p, raw.strip()):
            for part in [clean(x) for x in raw.split("\n") if x.strip()]:
                yield {"kind": "heading", "text": part, "links": links}
        else:
            t = clean(raw)
            if t:
                yield {"kind": "para", "text": t, "links": links}


def structure(blocks):
    """Attach a heading path to each paragraph: group > article > risk > section."""
    blocks = list(blocks)
    state = {"group": None, "article": None, "risk": None, "section": None, "in_study_risks": False}
    out = []
    for i, b in enumerate(blocks):
        if b["kind"] == "heading":
            h, hl = b["text"], b["text"].lower()
            nxt = next((x for x in blocks[i + 1:i + 2]), None)
            if hl in SUB_HEADINGS:
                state["section"] = h
                if hl.startswith("top risk"):
                    state["in_study_risks"] = True
            elif state["in_study_risks"] and hl.startswith("risk"):
                state["risk"], state["section"] = h, None
            elif nxt and nxt["kind"] == "heading" and nxt["text"].lower() not in SUB_HEADINGS \
                    and not nxt["text"].lower().startswith("risk") or hl.startswith(("hazard:", "risks involving", "human investigations", "about the five hazards")):
                state.update(group=h, article=None, risk=None, section=None, in_study_risks=False)
            else:
                state.update(article=h, risk=None, section=None, in_study_risks=False)
            out.append({**b, **{k: state[k] for k in ("group", "article", "risk", "section")}})
        else:
            out.append({**b, **{k: state[k] for k in ("group", "article", "risk", "section")}})
    return out


def merge_lists(paras):
    """Join 'X include:' lead-ins with the short item lines that follow into one bullet paragraph."""
    res, i = [], 0
    while i < len(paras):
        p = paras[i]
        if p["text"].rstrip().endswith(":") and len(p["text"].split()) < 40:
            items, j = [], i + 1
            while j < len(paras) and len(paras[j]["text"].split()) <= 14 and not paras[j]["text"].endswith(".") \
                    and paras[j].get("key") == p.get("key"):
                items.append(paras[j]); j += 1
            if items:
                res.append({**p, "text": p["text"] + "\n" + "\n".join("- " + x["text"] for x in items),
                            "links": p["links"] + sum((x["links"] for x in items), [])})
                i = j; continue
        res.append(p); i += 1
    return res


# ---------------------------------------------------------------- chunk
def make_chunks(doc_file, doc_id, default_hazard, fallback_url, seen):
    blocks = structure(parse_doc(SRC / doc_file))
    # resolve article-level source URLs: link whose slug best matches the article title
    all_links = [u for b in blocks for u in b["links"]]
    article_url = {}
    for b in blocks:
        title = b.get("risk") or b.get("article")
        if not title or title in article_url:
            continue
        tw, best, score = slug_words(title), None, 0.0
        for u in all_links:
            uw = slug_words(re.sub(r"https?://[^/]+", "", u))
            if tw and uw:
                s = len(tw & uw) / len(tw)
                if s > score: best, score = u, s
        article_url[title] = best if score >= 0.6 else None

    # group paragraphs by (article, risk, section)
    units, cur_key, cur = [], None, []
    dropped = {"boilerplate": 0, "duplicate": 0}
    vid_idx = 0
    for b in blocks:
        if b["kind"] != "para":
            continue
        t = b["text"]
        if DROP_LINE.match(t) or (len(t.split()) <= 2 and t.lower() in {"you", "transcript"}):
            continue
        if t.lower().replace("’", "'").startswith(BOILERPLATE_PREFIX):
            dropped["boilerplate"] += 1; continue
        if len(t.split()) >= 12:
            k = norm_key(t)
            if k in seen:
                dropped["duplicate"] += 1; continue
            seen.add(k)
        if re.match(r"^https?://(www\.)?youtube\.com/\S+$", t):
            vid_idx += 1  # each video URL starts its own unit
        key = (b["group"], b["article"], b["risk"], b["section"], vid_idx)
        if key != cur_key and cur:
            units.append((cur_key, cur)); cur = []
        cur_key = key
        cur.append({**b, "key": key})
    if cur: units.append((cur_key, cur))

    # intro line per article (used to tell podcast chunks which episode/guest they belong to)
    intro = {}
    for key, paras in units:
        art = key[1] or key[0]
        if key[3] is None and art not in intro:
            first = next((p["text"] for p in paras if len(p["text"].split()) >= 15), None)
            if first:
                intro[art] = " ".join(first.split()[:60])

    chunks = []
    for key, paras in units:
        group, article, risk, section, _vid = key
        paras = merge_lists(paras)
        def is_person(label):
            label = re.sub(r"\s*\(.*\)", "", label).strip()
            return label.lower() == "host" or (2 <= len(label.split()) <= 4 and
                                               all(w[:1].isupper() for w in label.split()))
        turns = [m for m in (SPEAKER.match(p["text"]) for p in paras)
                 if m and len(m.group(2).split()) >= 6 and is_person(m.group(1))]
        is_podcast = bool(section and section.lower() == "transcript") or \
            (len(turns) >= 3 and 2 <= len({m.group(1) for m in turns}) <= 6)
        is_video = any(re.match(r"^(transcript\s*:\s*)?\[\d\d:\d\d\]", p["text"], re.I) for p in paras)
        ctype = "podcast_transcript" if is_podcast else "video_transcript" if is_video else \
            "risk_card" if (risk or (article or "").lower().startswith("risk")) else "article"
        # source url: youtube url paragraph > article match > first specific link in unit > fallback
        yt = next((p["text"] for p in paras if re.match(r"^https?://(www\.)?youtube\.com/\S+$", p["text"])), None)
        specific = next((u for p in paras for u in p["links"] if not GENERIC_URL.search(u)), None)
        src = yt or article_url.get(risk or article) or specific or fallback_url
        paras = [p for p in paras if not re.match(r"^https?://\S+$", p["text"])]
        # pack paragraphs into chunks (podcast: on speaker turns)
        pieces = []
        for p in paras:
            t = re.sub(r"^transcript\s*:\s*", "", p["text"], flags=re.I)
            m = SPEAKER.match(t)
            if m: t = f"{m.group(1).strip()}: {m.group(2).strip()}"
            pieces.extend(split_sentences(t, MAX_WORDS) if len(t.split()) > MAX_WORDS else [t])
        packs, cur, last_speaker = [], [], None
        for t in pieces:
            m = SPEAKER.match(t) if ctype == "podcast_transcript" else None
            if cur and len(" ".join(cur + [t]).split()) > TARGET_WORDS:
                packs.append(cur); cur = []
                if ctype == "podcast_transcript" and not m and last_speaker:
                    t = f"{last_speaker} (continued): {t}"
            if m:
                last_speaker = m.group(1).strip()
            cur.append(t)
        if cur:
            if packs and len(" ".join(cur).split()) < MIN_WORDS and \
                    len(" ".join(packs[-1] + cur).split()) <= MAX_WORDS:
                packs[-1].extend(cur)
            else:
                packs.append(cur)
        path = [x for x in (group, article, risk, section) if x]
        for n, pk in enumerate(packs, 1):
            body = "\n\n".join(pk)
            risks = tag_risks(body, " ".join(path))
            hazards = [default_hazard] if default_hazard else \
                sorted({h for r in risks for h in RISKS[r]["hazards"]}) or ["cross_hazard"]
            chunks.append({
                "doc": doc_id, "hazards": hazards, "content_type": ctype,
                "title": risk or article or group or doc_id, "heading_path": path,
                "part": f"{n}/{len(packs)}", "source_url": src,
                "risks": risks, "words": len(body.split()), "text": body,
                "episode_intro": intro.get(article or group) if ctype == "podcast_transcript" else None,
            })
    # merge small neighbouring chunks that share the same top-level heading (group/article)
    merged = []
    for c in chunks:
        p = merged[-1] if merged else None
        same_parent = p and p["doc"] == c["doc"] and p["heading_path"][:1] == c["heading_path"][:1] \
            and p["content_type"] == c["content_type"] \
            and (c["content_type"] != "risk_card" or p["title"] == c["title"])  # never fuse two different risks
        if same_parent and (c["words"] < MIN_WORDS or p["words"] < MIN_WORDS) \
                and p["words"] + c["words"] <= MAX_WORDS:
            sec = " > ".join(x for x in c["heading_path"] if x not in p["heading_path"])
            p["text"] += f"\n\n[{sec}]\n{c['text']}" if sec else "\n\n" + c["text"]
            if p["title"] != c["title"] and c["title"] not in p.setdefault("also_covers", []):
                p["also_covers"].append(c["title"])
            p["words"] += c["words"]; p["risks"] = sorted(set(p["risks"]) | set(c["risks"]))
            p["hazards"] = sorted(set(p["hazards"]) | set(c["hazards"]))
        else:
            merged.append(c)
    return merged, dropped


def main():
    OUT.mkdir(exist_ok=True); (OUT / "review").mkdir(exist_ok=True)
    seen, all_chunks, report = set(), [], []
    for f, doc_id, hz, url in DOCS:
        chunks, dropped = make_chunks(f, doc_id, hz, url, seen)
        for i, c in enumerate(chunks, 1):
            c["id"] = f"{doc_id}-{i:03d}"
            hz_label = ", ".join(HAZARD_NAMES[h] for h in c["hazards"])
            c["context_header"] = f"[Hazard: {hz_label}] [{c['content_type']}] " + " > ".join(c["heading_path"])
            if c.get("episode_intro"):
                c["context_header"] += f" | Episode: {c['episode_intro']}"
        all_chunks += chunks
        report.append((f, doc_id, len(chunks), sum(c["words"] for c in chunks), dropped))
        with open(OUT / "review" / f"{doc_id}.md", "w", encoding="utf-8") as fh:
            fh.write(f"# {f}\n\n")
            for c in chunks:
                fh.write(f"## {c['id']}  ({c['words']} words, {c['content_type']})\n"
                         f"- path: {' > '.join(c['heading_path'])}\n- source: {c['source_url']}\n"
                         f"- hazards: {', '.join(c['hazards'])}\n- risks: {', '.join(c['risks']) or '-'}\n\n"
                         f"{c['text']}\n\n---\n\n")
    order = ["id", "doc", "hazards", "content_type", "title", "also_covers", "heading_path", "part",
             "source_url", "risks", "words", "context_header", "text"]
    with open(OUT / "chunks.jsonl", "w", encoding="utf-8") as fh:
        for c in all_chunks:
            c.setdefault("also_covers", [])
            fh.write(json.dumps({k: c[k] for k in order}, ensure_ascii=False) + "\n")
    # stats
    from collections import Counter
    words = [c["words"] for c in all_chunks]
    lines = ["# Knowledge base stats\n", f"Total chunks: **{len(all_chunks)}**, words: **{sum(words)}**, "
             f"chunk size min/median/max: {min(words)}/{sorted(words)[len(words)//2]}/{max(words)}\n",
             "| File | Chunks | Words | Boilerplate removed | Duplicates removed |", "|---|---|---|---|---|"]
    lines += [f"| {f} | {n} | {w} | {d['boilerplate']} | {d['duplicate']} |" for f, _, n, w, d in report]
    lines += ["\n## Chunks per hazard"] + [f"- {HAZARD_NAMES[h]}: {n}" for h, n in
              Counter(h for c in all_chunks for h in c["hazards"]).most_common()]
    lines += ["\n## Chunks per content type"] + [f"- {t}: {n}" for t, n in
              Counter(c["content_type"] for c in all_chunks).most_common()]
    lines += ["\n## Chunks per NASA risk"] + [f"- {RISKS[r]['name']}: {n}" for r, n in
              Counter(r for c in all_chunks for r in c["risks"]).most_common()]
    no_specific = sum(c["source_url"] in (HAZARDS_URL, "https://www.nasa.gov/hrp/risks/",
                      "https://www.nasa.gov/hrp/ongoing-hrp-research/") for c in all_chunks)
    lines += [f"\nChunks citing only the parent page (no article-specific URL found): {no_specific}"]
    (OUT / "stats.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.exit(main())
