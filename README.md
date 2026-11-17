# Praxis Practice tasters (public)

Free, one-example practice tasters for every Praxis Learn micro course: one page per metric, plus a library page.
Served by Cloudflare Pages (project `praxis-tools`) at https://tools.praxisls.co.za/ once the domain is connected,
and at https://praxis-tools.pages.dev/ before that.

Nothing here is edited by hand. Every page is baked once from the private master and frozen
(`build/bundle.py <tool> --taster --page=<page>` in `practice-tools-private`, then `build/taster-site.py`); the first
line of each page says which master commit it came from. Only one worked example per metric is in these files:
the ranges, other examples and generator code stay in the private repo.

`_redirects` holds the short links used in videos (one per video, generated from `build/short-links.csv`).
